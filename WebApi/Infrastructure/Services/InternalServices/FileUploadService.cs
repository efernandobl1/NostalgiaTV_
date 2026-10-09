using ApplicationCore.Exceptions;
using ApplicationCore.Settings;
using Infrastructure.Services.Media;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Configuration;
using System.Text.Json;
using System;
using System.Collections.Generic;
using System.Text;

namespace Infrastructure.Services.InternalServices
{
    public class FileUploadService
    {
        private readonly FileUploadSettings _settings;
        private readonly MediaSettings _mediaSettings;
        private readonly MediaProcessRunner _runner;
        private readonly IConfiguration _configuration;

        public FileUploadService(IOptions<FileUploadSettings> settings, IOptions<MediaSettings> mediaSettings,
            IConfiguration configuration, MediaProcessRunner runner)
        {
            _settings = settings.Value;
            _mediaSettings = mediaSettings.Value;
            _configuration = configuration;
            _runner = runner;
        }

        public async Task<string> UploadAsync(IFormFile file, string folder = "general")
        {
            var maxBytes = (long)_settings.MaxFileSizeMB * 1024 * 1024;
            if (file.Length <= 0 || file.Length > maxBytes)
                throw new BadRequestException($"File size exceeds {_settings.MaxFileSizeMB}MB.");

            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!_settings.AllowedExtensions.Contains(ext))
                throw new BadRequestException($"File type '{ext}' is not allowed.");

            var fileName = $"{Guid.NewGuid()}.webp";
            var storagePath = MediaStorageLayout.CreateDirectory(_mediaSettings.BasePath, folder);
            var fullPath = Path.Combine(storagePath, fileName);
            var temporary = Path.Combine(storagePath, $".upload-{Guid.NewGuid():N}.part");

            try
            {
                await using (var stream = new FileStream(temporary, FileMode.CreateNew))
                    await file.CopyToAsync(stream);
                var probe = new MediaProbe(_runner, _configuration);
                var metadata = await _runner.RunAsync(probe.Binary("ffprobe"),
                    ["-v", "error", "-protocol_whitelist", "file,pipe", "-show_streams", "-show_format", "-of", "json", temporary],
                    TimeSpan.FromSeconds(10), CancellationToken.None);
                using var json = JsonDocument.Parse(metadata);
                var streams = json.RootElement.GetProperty("streams").EnumerateArray().ToArray();
                if (streams.Length != 1 || streams[0].GetProperty("codec_name").GetString() is not ("png" or "mjpeg" or "webp") ||
                    streams[0].GetProperty("width").GetInt32() is < 1 or > 8192 ||
                    streams[0].GetProperty("height").GetInt32() is < 1 or > 8192 ||
                    (long)streams[0].GetProperty("width").GetInt32() * streams[0].GetProperty("height").GetInt32() > 16_000_000)
                    throw new BadRequestException("Upload a valid PNG, JPEG or WebP image of at most 16 megapixels.");
                // Re-encode decoded pixels, removing metadata and any appended payload.
                await _runner.RunAsync(probe.Binary("ffmpeg"),
                    ["-v", "error", "-xerror", "-nostdin", "-threads", "1", "-protocol_whitelist", "file,pipe", "-i", temporary,
                     "-frames:v", "1", "-map_metadata", "-1", "-c:v", "libwebp", "-threads", "1", "-quality", "85", "-f", "webp", fullPath],
                    TimeSpan.FromSeconds(15), CancellationToken.None);
            }
            catch (Exception error) when (error is IOException or JsonException or KeyNotFoundException or InvalidOperationException or OperationCanceledException)
            {
                if (File.Exists(fullPath)) File.Delete(fullPath);
                throw new BadRequestException("The uploaded image could not be decoded safely.");
            }
            finally { if (File.Exists(temporary)) File.Delete(temporary); }

            return $"/uploads/{MediaStorageLayout.RelativeFolder(_mediaSettings.BasePath, storagePath)}/{fileName}";
        }
    }
}
