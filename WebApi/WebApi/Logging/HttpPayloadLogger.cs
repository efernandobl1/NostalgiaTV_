using Serilog;

namespace WebApi.Logging
{
    /// <summary>Escribe los cuerpos HTTP seguros en archivos independientes al log operativo:
    /// <c>Logs/requests/request-*.txt</c> y <c>Logs/responses/response-*.txt</c>. Los valores
    /// llegan previamente redactados desde <see cref="Middleware.RequestResponseLoggingMiddleware"/>.</summary>
    public sealed class HttpPayloadLogger : IHttpPayloadLogger
    {
        private readonly Serilog.ILogger _requests;
        private readonly Serilog.ILogger _responses;

        public HttpPayloadLogger(IWebHostEnvironment environment)
        {
            var logs = Path.Combine(environment.ContentRootPath, "Logs");
            const string template = "{Timestamp:yyyy-MM-dd HH:mm:ss.fff} [{Level:u3}] [{RequestId}] [{UserId}] [{ClientIp}] {Message:lj}{NewLine}{Exception}";

            _requests = new LoggerConfiguration().MinimumLevel.Information().Enrich.FromLogContext()
                .WriteTo.File(Path.Combine(logs, "requests", "request-.txt"), rollingInterval: RollingInterval.Day,
                    retainedFileCountLimit: 30, fileSizeLimitBytes: 20 * 1024 * 1024,
                    rollOnFileSizeLimit: true, outputTemplate: template).CreateLogger();

            _responses = new LoggerConfiguration().MinimumLevel.Information().Enrich.FromLogContext()
                .WriteTo.File(Path.Combine(logs, "responses", "response-.txt"), rollingInterval: RollingInterval.Day,
                    retainedFileCountLimit: 30, fileSizeLimitBytes: 20 * 1024 * 1024,
                    rollOnFileSizeLimit: true, outputTemplate: template).CreateLogger();
        }

        public void Request(string method, string path, long? contentLength, string? contentType, string body) =>
            _requests.Information("{Method} {Path} | ContentLength={ContentLength} ContentType={ContentType} | Body={Body}",
                method, path, contentLength, contentType, body);

        public void Response(string method, string path, int statusCode, long elapsedMs, string? contentType, string body) =>
            _responses.Information("{Method} {Path} | StatusCode={StatusCode} ElapsedMs={ElapsedMs} ContentType={ContentType} | Body={Body}",
                method, path, statusCode, elapsedMs, contentType, body);

        public void Dispose()
        {
            (_requests as IDisposable)?.Dispose();
            (_responses as IDisposable)?.Dispose();
        }
    }
}
