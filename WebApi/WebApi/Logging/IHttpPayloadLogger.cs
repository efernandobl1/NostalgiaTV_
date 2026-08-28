namespace WebApi.Logging
{
    /// <summary>Escribe los cuerpos HTTP (ya redactados) en logs independientes al operativo.</summary>
    public interface IHttpPayloadLogger : IDisposable
    {
        void Request(string method, string path, long? contentLength, string? contentType, string body);
        void Response(string method, string path, int statusCode, long elapsedMs, string? contentType, string body);
    }
}
