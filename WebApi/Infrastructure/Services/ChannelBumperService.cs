using ApplicationCore.DTOs.ChannelBumper;
using ApplicationCore.Entities;
using ApplicationCore.Exceptions;
using ApplicationCore.Interfaces;
using ApplicationCore.Settings;
using Infrastructure.Contexts;
using Infrastructure.Services.InternalServices;
using Mapster;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Infrastructure.Services
{
    public class ChannelBumperService : IChannelBumperService
    {
        private readonly NostalgiaTVContext _context;
        private readonly FileUploadService _fileUploadService;
        private readonly MediaSettings _mediaSettings;

        public ChannelBumperService(NostalgiaTVContext context, FileUploadService fileUploadService, IOptions<MediaSettings> mediaSettings)
        {
            _context = context;
            _fileUploadService = fileUploadService;
            _mediaSettings = mediaSettings.Value;
        }

        public async Task<List<ChannelBumperResponse>> GetByEraAsync(int eraId)
        {
            var bumpers = await _context.ChannelBumpers
                .Where(b => b.ChannelEraId == eraId)
                .OrderBy(b => b.Order)
                .ToListAsync();

            return bumpers.Select(b => new ChannelBumperResponse
            {
                Id = b.Id,
                ChannelEraId = b.ChannelEraId,
                Title = b.Title,
                FilePath = b.FilePath,
                Order = b.Order
            }).ToList();
        }

        public async Task<ChannelBumperResponse> GetByIdAsync(int bumperId)
        {
            var bumper = await _context.ChannelBumpers.FindAsync(bumperId)
                ?? throw new NotFoundException($"ChannelBumper {bumperId} not found");

            return new ChannelBumperResponse
            {
                Id = bumper.Id,
                ChannelEraId = bumper.ChannelEraId,
                Title = bumper.Title,
                FilePath = bumper.FilePath,
                Order = bumper.Order
            };
        }

        public async Task<ChannelBumperResponse> CreateAsync(int eraId, ChannelBumperRequest request)
        {
            var era = await _context.ChannelEras
                .Include(e => e.Channel)
                .FirstOrDefaultAsync(e => e.Id == eraId)
                ?? throw new NotFoundException($"ChannelEra {eraId} not found");

            string? filePath = null;
            if (request.File != null)
            {
                var bumperFolder = Path.Combine(era.FolderPath ?? string.Empty, "bumpers");
                Directory.CreateDirectory(bumperFolder);

                var ext = Path.GetExtension(request.File.FileName).ToLowerInvariant();
                var fileName = $"{Guid.NewGuid()}{ext}";
                var fullPath = Path.Combine(bumperFolder, fileName);

                using var stream = new FileStream(fullPath, FileMode.Create);
                await request.File.CopyToAsync(stream);

                var relativePath = fullPath.Replace(_mediaSettings.BasePath, "").Replace("\\", "/");
                filePath = relativePath;
            }

            var bumper = new ChannelBumper
            {
                ChannelEraId = eraId,
                Title = request.Title,
                FilePath = filePath,
                Order = request.Order
            };

            _context.ChannelBumpers.Add(bumper);
            await _context.SaveChangesAsync();

            return new ChannelBumperResponse
            {
                Id = bumper.Id,
                ChannelEraId = bumper.ChannelEraId,
                Title = bumper.Title,
                FilePath = bumper.FilePath,
                Order = bumper.Order
            };
        }

        public async Task<ChannelBumperResponse> UpdateAsync(int bumperId, ChannelBumperRequest request)
        {
            var bumper = await _context.ChannelBumpers.FindAsync(bumperId)
                ?? throw new NotFoundException($"ChannelBumper {bumperId} not found");

            bumper.Title = request.Title;
            bumper.Order = request.Order;

            if (request.File != null)
            {
                var era = await _context.ChannelEras.FindAsync(bumper.ChannelEraId)
                    ?? throw new NotFoundException($"ChannelEra {bumper.ChannelEraId} not found");

                var bumperFolder = Path.Combine(era.FolderPath ?? string.Empty, "bumpers");
                Directory.CreateDirectory(bumperFolder);

                var ext = Path.GetExtension(request.File.FileName).ToLowerInvariant();
                var fileName = $"{Guid.NewGuid()}{ext}";
                var fullPath = Path.Combine(bumperFolder, fileName);

                using var stream = new FileStream(fullPath, FileMode.Create);
                await request.File.CopyToAsync(stream);

                var relativePath = fullPath.Replace(_mediaSettings.BasePath, "").Replace("\\", "/");
                bumper.FilePath = relativePath;
            }

            await _context.SaveChangesAsync();

            return new ChannelBumperResponse
            {
                Id = bumper.Id,
                ChannelEraId = bumper.ChannelEraId,
                Title = bumper.Title,
                FilePath = bumper.FilePath,
                Order = bumper.Order
            };
        }

        public async Task DeleteAsync(int bumperId)
        {
            var bumper = await _context.ChannelBumpers.FindAsync(bumperId)
                ?? throw new NotFoundException($"ChannelBumper {bumperId} not found");

            if (!string.IsNullOrEmpty(bumper.FilePath))
            {
                var fullPath = Path.Combine(_mediaSettings.BasePath, bumper.FilePath.TrimStart('/'));
                if (File.Exists(fullPath))
                    File.Delete(fullPath);
            }

            _context.ChannelBumpers.Remove(bumper);
            await _context.SaveChangesAsync();
        }

        public async Task<ChannelBumperResponse?> GetRandomBumperAsync(int eraId)
        {
            var bumpers = await _context.ChannelBumpers
                .Where(b => b.ChannelEraId == eraId && !string.IsNullOrEmpty(b.FilePath))
                .ToListAsync();

            if (bumpers.Count == 0) return null;

            var random = bumpers[new Random().Next(bumpers.Count)];

            return new ChannelBumperResponse
            {
                Id = random.Id,
                ChannelEraId = random.ChannelEraId,
                Title = random.Title,
                FilePath = random.FilePath,
                Order = random.Order
            };
        }

        public async Task<List<ChannelBumperResponse>> ScanFolderAsync(int eraId)
        {
            var era = await _context.ChannelEras
                .FirstOrDefaultAsync(e => e.Id == eraId)
                ?? throw new NotFoundException($"ChannelEra {eraId} not found");

            if (string.IsNullOrEmpty(era.FolderPath) || !Directory.Exists(era.FolderPath))
                throw new BadRequestException("Era folder not found.");

            var bumperFolder = Path.Combine(era.FolderPath, "bumpers");
            if (!Directory.Exists(bumperFolder))
                Directory.CreateDirectory(bumperFolder);

            var existingBumpers = await _context.ChannelBumpers
                .Where(b => b.ChannelEraId == eraId)
                .ToListAsync();

            var existingByPath = existingBumpers
                .Where(b => b.FilePath != null)
                .ToDictionary(b => NormalizePath(b.FilePath!), b => b);

            var videoExtensions = new HashSet<string> { ".mp4", ".mkv", ".avi", ".webm", ".mov", ".wmv", ".flv" };

            var scannedFiles = Directory.GetFiles(bumperFolder)
                .Where(f => videoExtensions.Contains(Path.GetExtension(f).ToLowerInvariant()))
                .ToList();

            var scannedPaths = scannedFiles.Select(f => NormalizePath(ToRelativePath(f))).ToHashSet();

            var toRemove = existingBumpers.Where(b =>
                b.FilePath == null || !scannedPaths.Contains(NormalizePath(b.FilePath))).ToList();
            _context.ChannelBumpers.RemoveRange(toRemove);

            var maxOrder = existingBumpers.Any() ? existingBumpers.Max(b => b.Order) : 0;
            var orderCounter = maxOrder;

            foreach (var filePath in scannedFiles)
            {
                var key = NormalizePath(ToRelativePath(filePath));
                var fileTitle = Path.GetFileNameWithoutExtension(filePath);
                var relativePath = ToRelativePath(filePath);

                if (existingByPath.TryGetValue(key, out var existing))
                {
                    existing.FilePath = relativePath;
                }
                else
                {
                    orderCounter++;
                    _context.ChannelBumpers.Add(new ChannelBumper
                    {
                        ChannelEraId = eraId,
                        Title = fileTitle,
                        FilePath = relativePath,
                        Order = orderCounter
                    });
                }
            }

            await _context.SaveChangesAsync();

            return await _context.ChannelBumpers
                .Where(b => b.ChannelEraId == eraId)
                .OrderBy(b => b.Order)
                .Select(b => new ChannelBumperResponse
                {
                    Id = b.Id,
                    ChannelEraId = b.ChannelEraId,
                    Title = b.Title,
                    FilePath = b.FilePath,
                    Order = b.Order
                })
                .ToListAsync();
        }

        private static string NormalizePath(string path) =>
            path.Replace("\\", "/").ToLowerInvariant().Trim();

        private static string ToRelativePath(string absolutePath)
        {
            var normalized = absolutePath.Replace("\\", "/");
            var wwwrootIndex = normalized.IndexOf("wwwroot", StringComparison.OrdinalIgnoreCase);
            return wwwrootIndex >= 0
                ? normalized[wwwrootIndex..]
                : normalized;
        }
    }
}
