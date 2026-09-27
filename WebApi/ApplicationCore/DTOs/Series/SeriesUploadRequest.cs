using Microsoft.AspNetCore.Http;

namespace ApplicationCore.DTOs.Series
{
    public class SeriesUploadRequest
    {
        public List<IFormFile> Files { get; set; } = [];
        // "season" | "specials" | "movies"
        public string Target { get; set; } = "season";
        public int? Season { get; set; }
    }

    public class SeriesUploadResult
    {
        public string FileName { get; set; } = string.Empty;
        public bool Success { get; set; }
        public string? FilePath { get; set; }
        public string? Error { get; set; }
    }
}
