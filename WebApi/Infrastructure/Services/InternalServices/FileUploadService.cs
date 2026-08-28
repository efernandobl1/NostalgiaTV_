using ApplicationCore.Exceptions;
using ApplicationCore.Settings;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using System;
using System.Collections.Generic;
using System.Text;

namespace Infrastructure.Services.InternalServices
{
    public class FileUploadService
    {
        private readonly FileUploadSettings _settings;
        private readonly MediaSettings _mediaSettings;

        public FileUploadService(IOptions<FileUploadSettings> settings, IOptions<MediaSettings> mediaSettings)
        {
            _settings = settings.Value;
            _mediaSettings = mediaSettings.Value;
        }

        public async Task<string> UploadAsync(IFormFile file, string folder = "general")
        {
            var maxBytes = _settings.MaxFileSizeMB * 1024 * 1024;
            if (file.Length > maxBytes)
                throw new BadRequestException($"File size exceeds {_settings.MaxFileSizeMB}MB.");

            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!_settings.AllowedExtensions.Contains(ext))
                throw new BadRequestException($"File type '{ext}' is not allowed.");

            var fileName = $"{Guid.NewGuid()}{ext}";
            var storagePath = Path.Combine(_mediaSettings.BasePath, folder);
            var fullPath = Path.Combine(storagePath, fileName);

            Directory.CreateDirectory(storagePath);

            using var stream = new FileStream(fullPath, FileMode.Create);
            await file.CopyToAsync(stream);

            return $"/uploads/{folder}/{fileName}";
        }
    }
}
