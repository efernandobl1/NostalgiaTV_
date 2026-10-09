using Serilog;

namespace WebApi.Logging
{
    /// <summary>Records HTTP metadata only. Credentials and payloads must never be supplied.</summary>
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
            _requests.Information("{Method} {Path} | ContentLength={ContentLength} ContentType={ContentType}",
                method, path, contentLength, contentType);

        public void Response(string method, string path, int statusCode, long elapsedMs, string? contentType, string body) =>
            _responses.Information("{Method} {Path} | StatusCode={StatusCode} ElapsedMs={ElapsedMs} ContentType={ContentType}",
                method, path, statusCode, elapsedMs, contentType);

        public void Dispose()
        {
            (_requests as IDisposable)?.Dispose();
            (_responses as IDisposable)?.Dispose();
        }
    }
}
