using System.Diagnostics;
using System.Text;
using System.Text.Json.Nodes;
using WebApi.Logging;

namespace WebApi.Middleware
{
    /// <summary>Guarda request/response en archivos separados de forma limitada y redactada.
    /// Credenciales, cookies, tokens y contenido binario/archivos jamás se persisten.</summary>
    public class RequestResponseLoggingMiddleware
    {
        private const int MaxBodyBytes = 16 * 1024;

        private static readonly HashSet<string> SensitiveFields = new(StringComparer.OrdinalIgnoreCase)
        {
            "password", "passwordHash", "token", "accessToken", "refreshToken",
            "authorization", "cookie", "refresh_token", "access_token"
        };

        private readonly RequestDelegate _next;
        public RequestResponseLoggingMiddleware(RequestDelegate next) => _next = next;

        public async Task InvokeAsync(HttpContext context, IHttpPayloadLogger logger)
        {
            var path = context.Request.Path.Value ?? string.Empty;

            // Los healthchecks se ejecutan cada pocos segundos y no aportan payload de
            // auditoría; excluirlos evita ruido y escrituras innecesarias.
            if (context.Request.Path.StartsWithSegments("/health"))
            {
                await _next(context);
                return;
            }

            var sensitiveEndpoint = path.Contains("/auth", StringComparison.OrdinalIgnoreCase);
            var requestBody = await ReadRequestAsync(context.Request, sensitiveEndpoint);
            logger.Request(context.Request.Method, path, context.Request.ContentLength, context.Request.ContentType, requestBody);

            // Solo se captura el cuerpo de respuestas de la API (JSON). Archivos estáticos,
            // media y descargas no se interceptan para no bufferizar binarios grandes.
            var captureResponse = path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase);
            if (!captureResponse)
            {
                var plainWatch = Stopwatch.StartNew();
                await _next(context);
                logger.Response(context.Request.Method, path, context.Response.StatusCode, plainWatch.ElapsedMilliseconds,
                    context.Response.ContentType, "[CUERPO NO CAPTURADO: ruta no API]");
                return;
            }

            var originalBody = context.Response.Body;
            await using var buffer = new MemoryStream();
            context.Response.Body = buffer;
            var watch = Stopwatch.StartNew();
            try
            {
                await _next(context);
            }
            finally
            {
                buffer.Position = 0;
                var responseBody = await ReadStreamAsync(buffer, context.Response.ContentType, sensitiveEndpoint);
                buffer.Position = 0;
                await buffer.CopyToAsync(originalBody);
                context.Response.Body = originalBody;
                logger.Response(context.Request.Method, path, context.Response.StatusCode, watch.ElapsedMilliseconds,
                    context.Response.ContentType, responseBody);
            }
        }

        private static async Task<string> ReadRequestAsync(HttpRequest request, bool sensitiveEndpoint)
        {
            if (sensitiveEndpoint) return "[REDACTADO: endpoint de autenticación]";
            if (!CanCapture(request.ContentType)) return "[CUERPO NO CAPTURADO: tipo no textual o archivo]";
            if (request.ContentLength is > MaxBodyBytes) return $"[CUERPO OMITIDO: supera {MaxBodyBytes} bytes]";
            request.EnableBuffering();
            var body = await ReadStreamAsync(request.Body, request.ContentType, false);
            request.Body.Position = 0;
            return body;
        }

        private static async Task<string> ReadStreamAsync(Stream stream, string? contentType, bool sensitiveEndpoint)
        {
            if (sensitiveEndpoint) return "[REDACTADO: endpoint de autenticación]";
            if (!CanCapture(contentType)) return "[CUERPO NO CAPTURADO: tipo no textual o archivo]";
            if (stream.CanSeek && stream.Length > MaxBodyBytes) return $"[CUERPO OMITIDO: supera {MaxBodyBytes} bytes]";
            using var reader = new StreamReader(stream, Encoding.UTF8, detectEncodingFromByteOrderMarks: true, bufferSize: 1024, leaveOpen: true);
            var body = await reader.ReadToEndAsync();
            return Redact(body);
        }

        private static bool CanCapture(string? contentType) =>
            !string.IsNullOrWhiteSpace(contentType) &&
            (contentType.Contains("application/json", StringComparison.OrdinalIgnoreCase) ||
             contentType.StartsWith("text/", StringComparison.OrdinalIgnoreCase));

        private static string Redact(string body)
        {
            if (string.IsNullOrWhiteSpace(body)) return "[VACÍO]";
            try
            {
                var node = JsonNode.Parse(body);
                RedactNode(node);
                return node?.ToJsonString() ?? "[VACÍO]";
            }
            catch (Exception)
            {
                // Los textos no JSON se conservan sólo cuando son pequeños y textuales.
                return body.Length > MaxBodyBytes ? $"[CUERPO OMITIDO: supera {MaxBodyBytes} bytes]" : body;
            }
        }

        private static void RedactNode(JsonNode? node)
        {
            if (node is JsonObject obj)
            {
                foreach (var property in obj.ToList())
                {
                    if (SensitiveFields.Contains(property.Key)) obj[property.Key] = "[REDACTADO]";
                    else RedactNode(property.Value);
                }
            }
            else if (node is JsonArray array)
            {
                foreach (var item in array) RedactNode(item);
            }
        }
    }
}
