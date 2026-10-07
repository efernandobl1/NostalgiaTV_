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
using Infrastructure.Services.Media;
using Microsoft.AspNetCore.Http;

namespace Infrastructure.Services
{
    public class ChannelBumperService : IChannelBumperService
    {
        private readonly NostalgiaTVContext _context;
        private readonly FileUploadService _fileUploadService;
        private readonly MediaSettings _mediaSettings;
        private readonly MediaProbe _probe;

        public ChannelBumperService(NostalgiaTVContext context, FileUploadService fileUploadService, IOptions<MediaSettings> mediaSettings, MediaProbe probe)
        {
            _context = context;
            _fileUploadService = fileUploadService;
            _mediaSettings = mediaSettings.Value;
            _probe = probe;
        }

        public async Task<List<ChannelBumperResponse>> GetByEraAsync(int eraId)
        {
            var bumpers = await _context.ChannelBumpers
                .AsNoTracking()
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
                filePath = await UploadBumperAsync(era, request.File);
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

                bumper.FilePath = await UploadBumperAsync(era, request.File);
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
                var relative = bumper.FilePath.Replace('\\', '/').TrimStart('/');
                if (relative.StartsWith("wwwroot/uploads/")) relative = relative["wwwroot/uploads/".Length..];
                else if (relative.StartsWith("uploads/")) relative = relative["uploads/".Length..];
                var fullPath = Path.GetFullPath(Path.Combine(_mediaSettings.BasePath, relative));
                if (File.Exists(fullPath))
                {
                    MediaFilePolicy.SafePath(_mediaSettings.BasePath, fullPath);
                    File.Delete(fullPath);
                }
            }

            _context.ChannelBumpers.Remove(bumper);
            await _context.SaveChangesAsync();
        }

        public async Task<ChannelBumperResponse?> GetRandomBumperAsync(int eraId)
        {
            var bumpers = await _context.ChannelBumpers
                .AsNoTracking()
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

            var bumperFolder = MediaStorageLayout.CreateDirectory(_mediaSettings.BasePath,
                MediaStorageLayout.RelativeFolder(_mediaSettings.BasePath, era.FolderPath) + "/bumpers");

            var existingBumpers = await _context.ChannelBumpers
                .Where(b => b.ChannelEraId == eraId)
                .ToListAsync();

            var existingByPath = existingBumpers
                .Where(b => b.FilePath != null)
                .ToDictionary(b => NormalizePath(b.FilePath!), b => b);

            var scannedFiles = new List<string>();
            foreach (var path in Directory.EnumerateFiles(bumperFolder).Where(MediaFilePolicy.IsCandidate))
            {
                MediaFilePolicy.SafePath(_mediaSettings.BasePath, path);
                try { if ((await _probe.ReadAsync(path, CancellationToken.None)).Compatible) scannedFiles.Add(path); }
                catch (IOException) { /* Unfinished or incompatible bumpers are not imported. */ }
            }

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

        private static string NormalizePath(string path)
        {
            var relative = path.Replace('\\', '/').Trim().TrimStart('/');
            if (relative.StartsWith("wwwroot/", StringComparison.OrdinalIgnoreCase)) relative = relative["wwwroot/".Length..];
            if (!relative.StartsWith("uploads/", StringComparison.OrdinalIgnoreCase)) relative = "uploads/" + relative;
            return relative.ToLowerInvariant();
        }

        private string ToRelativePath(string absolutePath)
        {
            return "/uploads/" + Path.GetRelativePath(_mediaSettings.BasePath, absolutePath).Replace('\\', '/');
        }

        private async Task<string> UploadBumperAsync(ChannelEra era, IFormFile file)
        {
            if (file.Length is <= 0 or > 524_288_000 || !Path.GetExtension(file.FileName).Equals(".mp4", StringComparison.OrdinalIgnoreCase))
                throw new BadRequestException("A web-compatible MP4 under 500 MiB is required.");
            if (string.IsNullOrWhiteSpace(era.FolderPath))
                era.FolderPath = MediaStorageLayout.CreateDirectory(_mediaSettings.BasePath, MediaStorageLayout.EraFolder(era.ChannelId, era.Id));
            var folder = MediaStorageLayout.CreateDirectory(_mediaSettings.BasePath,
                MediaStorageLayout.RelativeFolder(_mediaSettings.BasePath, era.FolderPath) + "/bumpers");
            var path = Path.Combine(folder, $"{Guid.NewGuid():N}.mp4");
            try
            {
                await using (var stream = new FileStream(path, FileMode.CreateNew)) await file.CopyToAsync(stream);
                if (!(await _probe.ReadAsync(path, CancellationToken.None)).Compatible)
                    throw new BadRequestException("Bumpers require MP4/H.264/AAC compatible video.");
                return ToRelativePath(path);
            }
            catch
            {
                if (File.Exists(path)) File.Delete(path);
                throw;
            }
        }
    }
}
