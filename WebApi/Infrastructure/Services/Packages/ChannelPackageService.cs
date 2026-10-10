using System.IO.Compression;
using System.Security.Cryptography;
using System.Text.Json;
using ApplicationCore.DTOs.Packages;
using ApplicationCore.Entities;
using ApplicationCore.Settings;
using Infrastructure.Contexts;
using Infrastructure.Services.Media;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Infrastructure.Services.Packages;

public sealed class ChannelPackageService(NostalgiaTVContext context, IOptions<MediaSettings> settings,
    MediaProbe probe, MediaProcessRunner runner)
{
    private string Root => Path.GetFullPath(settings.Value.BasePath);

    public async Task<ChannelPackagePreview> PreviewAsync(Stream stream, CancellationToken token)
    {
        using var archive = new ZipArchive(stream, ZipArchiveMode.Read, leaveOpen: true);
        var (manifest, fingerprint) = await ChannelPackageArchive.ReadAsync(archive, token);
        return new(manifest, fingerprint, await context.Channels.AnyAsync(item => item.ShareId == manifest.PackageId, token),
            await MatchSeriesAsync(manifest.Series, token), manifest.Assets.Sum(item => item.Size));
    }

    public async Task<string> ExportAsync(int channelId, bool includeMedia, CancellationToken token, string? sharingPermission = null)
    {
        sharingPermission = string.IsNullOrWhiteSpace(sharingPermission) ? null : sharingPermission.Trim();
        ChannelPackageArchive.Require(sharingPermission?.Length is not > 500,
            "El permiso de redistribución no puede superar 500 caracteres.");
        var channel = await context.Channels.AsNoTracking().Include(item => item.Eras).ThenInclude(item => item.SeriesLinks)
            .ThenInclude(item => item.SelectedSeasons).SingleOrDefaultAsync(item => item.Id == channelId, token)
            ?? throw new KeyNotFoundException("El canal no existe.");
        var eraIds = channel.Eras.Select(item => item.Id).ToArray();
        var assignments = await context.ChannelEraInterludes.AsNoTracking().Where(item => eraIds.Contains(item.ChannelEraId)).ToListAsync(token);
        var clipIds = assignments.Select(item => item.InterludeId).Distinct().ToArray();
        var clips = await context.Interludes.AsNoTracking().Where(item => clipIds.Contains(item.Id)).OrderBy(item => item.Id).ToListAsync(token);
        // Package-level permission applies only to this export, never to stored clip rights.
        var shared = includeMedia ? clips.Where(item => !string.IsNullOrWhiteSpace(sharingPermission)
            || (item.RedistributionAllowed && !string.IsNullOrWhiteSpace(item.License))).ToList() : [];
        var seriesIds = channel.Eras.SelectMany(item => item.SeriesLinks).Select(item => item.SeriesId).Distinct().ToArray();
        var series = await context.Series.AsNoTracking().Where(item => seriesIds.Contains(item.Id)).OrderBy(item => item.Id).ToListAsync(token);
        var external = await (from link in context.SeriesExternalIds.AsNoTracking()
            join provider in context.MetadataProviders on link.ProviderId equals provider.Id
            where seriesIds.Contains(link.SeriesId)
            select new { link.SeriesId, provider.Code, link.ExternalId }).ToListAsync(token);
        var rules = await context.ChannelEraBreakRules.AsNoTracking().Where(item => eraIds.Contains(item.ChannelEraId)).ToListAsync(token);
        var selected = await context.ChannelEraSelections.AsNoTracking().SingleOrDefaultAsync(item => item.ChannelId == channelId, token);
        var seriesKeys = series.Select((item, index) => (item.Id, Key: $"series-{index + 1}")).ToDictionary(item => item.Id, item => item.Key);
        var clipKeys = shared.Select((item, index) => (item.Id, Key: $"clip-{index + 1}")).ToDictionary(item => item.Id, item => item.Key);
        var eraKeys = channel.Eras.OrderBy(item => item.Id).Select((item, index) => (item.Id, Key: $"era-{index + 1}")).ToDictionary(item => item.Id, item => item.Key);
        var manifest = new ChannelPackageManifest { PackageId = channel.ShareId, Name = channel.Name, History = channel.History,
            SchemaVersion = assignments.Any(item => clipKeys.ContainsKey(item.InterludeId)
                && (item.SeriesId != null || item.Role == BreakRole.ProgramIntro)) ? 2 : 1,
            StartDate = channel.StartDate, EndDate = channel.EndDate, SelectedEra = selected == null ? null : eraKeys.GetValueOrDefault(selected.ChannelEraId),
            ExcludedClips = clips.Count - shared.Count + await context.ChannelBumpers.CountAsync(item => eraIds.Contains(item.ChannelEraId), token),
            Series = series.Select(item => new PackageSeries { Key = seriesKeys[item.Id], Name = item.Name, Description = item.Description,
                StartDate = item.StartDate, Seasons = item.Seasons,
                ExternalIds = external.Where(link => link.SeriesId == item.Id).Select(link => new PackageExternalId(link.Code, link.ExternalId)).ToList() }).ToList(),
            Eras = channel.Eras.OrderBy(item => item.Id).Select(item => new PackageEra { Key = eraKeys[item.Id], Name = item.Name,
                Description = item.Description, StartDate = item.StartDate, EndDate = item.EndDate,
                Series = item.SeriesLinks.Select(link => new PackageSeriesSelection(seriesKeys[link.SeriesId], link.HasSeasonFilter,
                    link.SelectedSeasons.Select(season => season.SeasonNumber).Order().ToArray())).ToList(),
                Clips = assignments.Where(link => link.ChannelEraId == item.Id && clipKeys.ContainsKey(link.InterludeId))
                    .Select(link => new PackageClipAssignment(clipKeys[link.InterludeId], link.Role, link.Weight, link.MinimumGapSeconds,
                        link.SeriesId is int seriesId ? seriesKeys[seriesId] : null)).ToList(),
                BreakRules = rules.Where(rule => rule.ChannelEraId == item.Id)
                    .Select(rule => new PackageBreakRules(rule.MinimumAds, rule.MaximumAds, rule.MaximumBreakSeconds)).SingleOrDefault() }).ToList() };
        var folder = StagingFolder();
        var path = Path.Combine(folder, "package.part");
        try
        {
            await using (var output = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None))
            using (var archive = new ZipArchive(output, ZipArchiveMode.Create, leaveOpen: true))
            {
                if (includeMedia && !string.IsNullOrWhiteSpace(channel.LogoPath))
                    manifest.LogoAsset = await AddAssetAsync(archive, manifest, channel.LogoPath, isLogo: true, token);
                foreach (var clip in shared)
                    manifest.Clips.Add(new PackageClip { Key = clipKeys[clip.Id], Title = clip.Title, Kind = clip.Kind, Season = clip.Season,
                        Asset = await AddAssetAsync(archive, manifest, clip.FilePath, isLogo: false, token), OriginalYearFrom = clip.OriginalYearFrom,
                        OriginalYearTo = clip.OriginalYearTo, RegionCode = clip.RegionCode, SourceUrl = clip.SourceUrl,
                        License = clip.RedistributionAllowed && !string.IsNullOrWhiteSpace(clip.License)
                            ? clip.License : sharingPermission! });
                ChannelPackageArchive.Validate(manifest);
                await using var metadata = archive.CreateEntry("manifest.json", CompressionLevel.NoCompression).Open();
                var bytes = JsonSerializer.SerializeToUtf8Bytes(manifest, ChannelPackageArchive.Json);
                ChannelPackageArchive.Require(bytes.Length <= ChannelPackageArchive.MaxManifestBytes, "El manifiesto supera 1 MiB.");
                await metadata.WriteAsync(bytes, token);
            }
            ChannelPackageArchive.Require(new FileInfo(path).Length <= ChannelPackageArchive.MaxBytes, "El paquete supera 500 MiB.");
            return path;
        }
        catch { Directory.Delete(folder, recursive: true); throw; }
    }

    public async Task<ChannelPackageImportResult> ImportAsync(Stream stream, string fingerprint, CancellationToken token)
    {
        using var archive = new ZipArchive(stream, ZipArchiveMode.Read, leaveOpen: true);
        var (manifest, currentFingerprint) = await ChannelPackageArchive.ReadAsync(archive, token);
        ChannelPackageArchive.Require(fingerprint == currentFingerprint, "El paquete cambió después de la vista previa. Revísalo nuevamente.");
        if (await context.Channels.AnyAsync(item => item.ShareId == manifest.PackageId, token))
            throw new ChannelPackageConflictException("Este paquete ya está instalado. No se duplicó el canal.");
        var matches = await MatchSeriesAsync(manifest.Series, token);
        var stage = StagingFolder();
        var moved = new List<string>();
        var staged = new Dictionary<string, string>();
        var durations = new Dictionary<string, decimal>();
        try
        {
            ReserveSpace(manifest.Assets.Sum(item => item.Size));
            foreach (var asset in manifest.Assets)
            {
                var path = Path.Combine(stage, Guid.NewGuid().ToString("N") + ".part");
                await using (var file = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None))
                    await ChannelPackageArchive.CopyBoundedAsync(archive.GetEntry(asset.Path)!, file, asset.Size, token);
                await using (var file = File.OpenRead(path))
                    ChannelPackageArchive.Require(Convert.ToHexString(await SHA256.HashDataAsync(file, token))
                        .Equals(asset.Sha256, StringComparison.OrdinalIgnoreCase), "La integridad de un archivo no coincide.");
                if (asset.Path.EndsWith(".mp4"))
                {
                    var info = await probe.ReadAsync(path, token, ".mp4");
                    ChannelPackageArchive.Require(info.Compatible && info.Duration <= 1800,
                        "Los bumpers y anuncios deben ser MP4 compatibles de hasta 30 minutos.");
                    durations[asset.Path] = decimal.Round((decimal)info.Duration, 3);
                }
                else await ValidateLogoAsync(path, Path.GetExtension(asset.Path), token);
                staged[asset.Path] = path;
            }
            await using var transaction = await context.Database.BeginTransactionAsync(token);
            var channel = new Channel { ShareId = manifest.PackageId, Name = manifest.Name, History = manifest.History,
                StartDate = manifest.StartDate, EndDate = manifest.EndDate };
            context.Channels.Add(channel);
            await context.SaveChangesAsync(token);
            if (manifest.LogoAsset != null)
                channel.LogoPath = Publish(manifest.LogoAsset, MediaStorageLayout.ChannelFolder(channel.Id));
            var localSeries = new Dictionary<string, Series>();
            foreach (var item in manifest.Series)
            {
                var existingId = matches.Single(match => match.Key == item.Key).ExistingId;
                var local = existingId.HasValue ? await context.Series.FindAsync([existingId.Value], token) : null;
                if (local == null)
                {
                    local = new Series { Name = item.Name, Description = item.Description, StartDate = item.StartDate, Seasons = item.Seasons };
                    context.Series.Add(local);
                    await context.SaveChangesAsync(token);
                    local.FolderPath = MediaStorageLayout.CreateDirectory(Root, MediaStorageLayout.SeriesFolder(local.Name, local.Id));
                    foreach (var external in item.ExternalIds)
                    {
                        var provider = await context.MetadataProviders.SingleOrDefaultAsync(value => value.Code == external.Provider, token);
                        if (provider == null)
                        {
                            provider = new MetadataProvider { Code = external.Provider, Name = external.Provider };
                            context.MetadataProviders.Add(provider);
                            await context.SaveChangesAsync(token);
                        }
                        context.SeriesExternalIds.Add(new SeriesExternalId { SeriesId = local.Id, ProviderId = provider.Id, ExternalId = external.ExternalId });
                    }
                }
                localSeries[item.Key] = local;
                channel.Series.Add(local);
            }
            var localClips = new Dictionary<string, Interlude>();
            foreach (var item in manifest.Clips)
            {
                var clip = new Interlude { Title = item.Title, Kind = item.Kind, Season = item.Season,
                    FilePath = Publish(item.Asset, MediaStorageLayout.BroadcastFolder(item.Kind)), DurationSeconds = durations[item.Asset],
                    OriginalYearFrom = item.OriginalYearFrom, OriginalYearTo = item.OriginalYearTo, RegionCode = item.RegionCode,
                    SourceUrl = item.SourceUrl, License = item.License, RedistributionAllowed = true, ApprovedForBroadcast = false };
                context.Interludes.Add(clip);
                localClips[item.Key] = clip;
            }
            await context.SaveChangesAsync(token);
            foreach (var item in manifest.Eras)
            {
                var era = new ChannelEra { ChannelId = channel.Id, Name = item.Name, Description = item.Description,
                    StartDate = item.StartDate, EndDate = item.EndDate };
                context.ChannelEras.Add(era);
                await context.SaveChangesAsync(token);
                era.FolderPath = MediaStorageLayout.CreateDirectory(Root, MediaStorageLayout.EraFolder(channel.Id, era.Id));
                foreach (var selection in item.Series)
                    context.ChannelEraSeries.Add(new ChannelEraSeries { ChannelEraId = era.Id, SeriesId = localSeries[selection.SeriesKey].Id,
                        HasSeasonFilter = selection.HasSeasonFilter, SelectedSeasons = selection.HasSeasonFilter
                            ? selection.Seasons.Select(number => new ChannelEraSelectedSeason { SeasonNumber = number }).ToList() : [] });
                foreach (var assignment in item.Clips)
                    context.ChannelEraInterludes.Add(new ChannelEraInterlude { ChannelEraId = era.Id, InterludeId = localClips[assignment.ClipKey].Id,
                        Role = assignment.Role, Weight = assignment.Weight, MinimumGapSeconds = assignment.MinimumGapSeconds,
                        SeriesId = assignment.SeriesKey == null ? null : localSeries[assignment.SeriesKey].Id });
                if (item.BreakRules is { } rule)
                    context.ChannelEraBreakRules.Add(new ChannelEraBreakRule { ChannelEraId = era.Id, MinimumAds = rule.MinimumAds,
                        MaximumAds = rule.MaximumAds, MaximumBreakSeconds = rule.MaximumBreakSeconds });
                if (item.Key == manifest.SelectedEra)
                    context.ChannelEraSelections.Add(new ChannelEraSelection { ChannelId = channel.Id, ChannelEraId = era.Id, SelectedAtUtc = DateTime.UtcNow });
            }
            await context.SaveChangesAsync(token);
            await transaction.CommitAsync(token);
            return new(channel.Id, matches.Count(item => item.ExistingId == null), matches.Count(item => item.ExistingId != null), localClips.Count);
        }
        catch
        {
            foreach (var path in moved) File.Delete(path);
            throw;
        }
        finally { Directory.Delete(stage, recursive: true); }

        string Publish(string asset, string folder)
        {
            var directory = MediaStorageLayout.CreateDirectory(Root, folder);
            var name = Guid.NewGuid().ToString("N") + Path.GetExtension(asset);
            var path = Path.Combine(directory, name);
            File.Move(staged[asset], path, overwrite: false);
            moved.Add(path);
            return $"/uploads/{folder}/{name}";
        }
    }

    private async Task<List<PackageSeriesMatch>> MatchSeriesAsync(List<PackageSeries> series, CancellationToken token)
    {
        var result = new List<PackageSeriesMatch>();
        foreach (var item in series)
        {
            var ids = new HashSet<int>();
            foreach (var external in item.ExternalIds)
                foreach (var id in await (from link in context.SeriesExternalIds
                    join provider in context.MetadataProviders on link.ProviderId equals provider.Id
                    where provider.Code == external.Provider && link.ExternalId == external.ExternalId
                    select link.SeriesId).ToListAsync(token)) ids.Add(id);
            if (ids.Count == 0)
                foreach (var id in await context.Series.Where(value => value.Name == item.Name && value.StartDate == item.StartDate)
                    .Select(value => value.Id).ToListAsync(token)) ids.Add(id);
            ChannelPackageArchive.Require(ids.Count <= 1, $"Hay más de una coincidencia para {item.Name}. Revisa sus identificadores antes de instalar.");
            int? existing = ids.Count == 1 ? ids.Single() : null;
            if (existing.HasValue)
            {
                var identities = await (from link in context.SeriesExternalIds
                    join provider in context.MetadataProviders on link.ProviderId equals provider.Id
                    where link.SeriesId == existing.Value
                    select new { provider.Code, link.ExternalId }).ToListAsync(token);
                ChannelPackageArchive.Require(!item.ExternalIds.Any(external => identities.Any(local =>
                    local.Code == external.Provider && local.ExternalId != external.ExternalId)),
                    $"Los identificadores de {item.Name} no coinciden con la serie local.");
            }
            result.Add(new(item.Key, item.Name, existing, existing == null ? 0 : await context.Episodes.CountAsync(value => value.SeriesId == existing && value.IsAvailable, token)));
        }
        ChannelPackageArchive.Require(result.Where(item => item.ExistingId != null).Select(item => item.ExistingId).Distinct().Count()
            == result.Count(item => item.ExistingId != null), "Varias series del paquete coinciden con la misma serie local.");
        return result;
    }

    private async Task<string> AddAssetAsync(ZipArchive archive, ChannelPackageManifest manifest, string source, bool isLogo, CancellationToken token)
    {
        ChannelPackageArchive.Require(source.StartsWith("/uploads/", StringComparison.Ordinal), "El archivo compartido no pertenece a la biblioteca.");
        var path = MediaFilePolicy.SafePath(Root, Path.Combine(Root, source[9..]));
        var extension = Path.GetExtension(path).ToLowerInvariant();
        ChannelPackageArchive.Require(isLogo ? extension is ".png" or ".jpg" or ".webp" : extension == ".mp4", "El tipo de archivo no está admitido en paquetes.");
        var size = new FileInfo(path).Length;
        ChannelPackageArchive.Require(size > 0 && size <= (isLogo ? 5_242_880 : ChannelPackageArchive.MaxBytes)
            && manifest.Assets.Sum(item => item.Size) + size <= ChannelPackageArchive.MaxBytes - ChannelPackageArchive.MaxManifestBytes,
            "Los archivos compartidos superan el límite del paquete.");
        ReserveSpace(size);
        var key = "assets/" + Guid.NewGuid().ToString("N") + extension;
        await using var input = File.OpenRead(path);
        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        await using var output = archive.CreateEntry(key, CompressionLevel.NoCompression).Open();
        var buffer = new byte[81920];
        long copied = 0;
        int count;
        while ((count = await input.ReadAsync(buffer, token)) != 0)
        {
            copied += count;
            ChannelPackageArchive.Require(copied <= size, "Un archivo cambió mientras se preparaba el paquete.");
            hash.AppendData(buffer, 0, count);
            await output.WriteAsync(buffer.AsMemory(0, count), token);
        }
        ChannelPackageArchive.Require(copied == size, "Un archivo cambió mientras se preparaba el paquete.");
        manifest.Assets.Add(new(key, size, Convert.ToHexString(hash.GetHashAndReset())));
        return key;
    }

    private async Task ValidateLogoAsync(string path, string extension, CancellationToken token)
    {
        var json = await runner.RunAsync(probe.Binary("ffprobe"), ["-v", "error", "-protocol_whitelist", "file,pipe",
            "-show_streams", "-of", "json", path], TimeSpan.FromSeconds(15), token);
        using var document = JsonDocument.Parse(json);
        var streams = document.RootElement.GetProperty("streams").EnumerateArray().ToArray();
        var codec = extension switch { ".png" => "png", ".jpg" => "mjpeg", ".webp" => "webp", _ => "" };
        ChannelPackageArchive.Require(streams.Length == 1 && streams[0].GetProperty("codec_name").GetString() == codec
            && streams[0].GetProperty("width").GetInt32() is > 0 and <= 4096
            && streams[0].GetProperty("height").GetInt32() is > 0 and <= 4096, "El logo debe ser una imagen PNG, JPG o WebP de hasta 4096 píxeles.");
    }

    private string StagingFolder() => MediaStorageLayout.CreateDirectory(Root, ".packages/" + Guid.NewGuid().ToString("N"));
    private void ReserveSpace(long bytes) => ChannelPackageArchive.Require(MediaStorageMeter.DriveForPath(Root).AvailableFreeSpace >= bytes + 536_870_912,
        "No hay espacio suficiente para el paquete y una reserva de 512 MiB.");
}

public sealed class ChannelPackageConflictException(string message) : Exception(message);
