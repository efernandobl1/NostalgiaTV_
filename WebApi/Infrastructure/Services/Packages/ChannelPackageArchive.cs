using System.IO.Compression;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using ApplicationCore.DTOs.Packages;
using ApplicationCore.Entities;

namespace Infrastructure.Services.Packages;

public static class ChannelPackageArchive
{
    public const long MaxBytes = 524_288_000;
    public const int MaxManifestBytes = 1_048_576;
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        RespectNullableAnnotations = true,
        MaxDepth = 16
    };

    public static async Task<(ChannelPackageManifest Manifest, string Fingerprint)> ReadAsync(ZipArchive archive, CancellationToken token)
    {
        Require(archive.Entries.Count is > 0 and <= 130, "El paquete contiene demasiados archivos.");
        var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        long total = 0;
        foreach (var entry in archive.Entries)
        {
            Require(names.Add(entry.FullName) && (entry.FullName == "manifest.json" ||
                Regex.IsMatch(entry.FullName, @"\Aassets/[a-f0-9]{32}\.(mp4|png|jpg|webp)\z")), "El paquete contiene rutas o archivos no permitidos.");
            Require(((entry.ExternalAttributes >> 16) & 0xF000) != 0xA000, "El paquete contiene enlaces simbólicos.");
            Require(entry.Length > 0 && entry.Length <= MaxBytes && entry.Length <= MaxBytes - total,
                "El contenido del paquete supera 500 MiB.");
            total += entry.Length;
        }
        var metadata = archive.GetEntry("manifest.json");
        Require(metadata != null && metadata.Length <= MaxManifestBytes, "Falta un manifiesto válido de hasta 1 MiB.");
        using var buffer = new MemoryStream();
        await CopyBoundedAsync(metadata!, buffer, MaxManifestBytes, token);
        var bytes = buffer.ToArray();
        ChannelPackageManifest manifest;
        try
        {
            var content = bytes.AsSpan();
            if (content.StartsWith(new byte[] { 0xEF, 0xBB, 0xBF })) content = content[3..];
            manifest = JsonSerializer.Deserialize<ChannelPackageManifest>(content, Json) ?? throw new JsonException();
        }
        catch (JsonException) { throw new InvalidDataException("El manifiesto no tiene el formato esperado."); }
        Validate(manifest);
        Require(manifest.Assets.Count + 1 == archive.Entries.Count, "El paquete incluye archivos sin declarar.");
        foreach (var asset in manifest.Assets)
        {
            var entry = archive.GetEntry(asset.Path);
            Require(entry != null && entry.Length == asset.Size, "Falta un archivo declarado o su tamaño no coincide.");
        }
        return (manifest, Convert.ToHexString(SHA256.HashData(bytes)));
    }

    public static void Validate(ChannelPackageManifest manifest)
    {
        Require(manifest.SchemaVersion == 1 && manifest.PackageId != Guid.Empty && manifest.Version == "1.0.0",
            "Esta versión del paquete no es compatible.");
        Require(manifest.SchedulingMode == "Shuffle", "La primera versión admite programación aleatoria, no horarios fijos.");
        Text(manifest.Name, 200);
        OptionalText(manifest.History, 20_000);
        Require(manifest.EndDate == null || manifest.EndDate >= manifest.StartDate, "Las fechas del canal no son válidas.");
        Require(manifest.ExcludedClips >= 0 && manifest.Series is { Count: <= 200 } && manifest.Eras is { Count: > 0 and <= 30 }
            && manifest.Clips is { Count: <= 128 } && manifest.Assets is { Count: <= 129 }, "El paquete supera los límites de contenido.");
        Unique(manifest.Series.Select(item => item?.Key));
        Unique(manifest.Eras.Select(item => item?.Key));
        Unique(manifest.Clips.Select(item => item?.Key));
        var assets = new HashSet<string>(StringComparer.Ordinal);
        long total = 0;
        foreach (var asset in manifest.Assets)
        {
            Require(asset != null && assets.Add(asset.Path) && Regex.IsMatch(asset.Path, @"\Aassets/[a-f0-9]{32}\.(mp4|png|jpg|webp)\z")
                && asset.Size is > 0 and <= MaxBytes && asset.Size <= MaxBytes - total
                && Regex.IsMatch(asset.Sha256, @"\A[a-fA-F0-9]{64}\z"), "Los archivos declarados no son válidos.");
            total += asset!.Size;
        }
        var referenced = new HashSet<string>(StringComparer.Ordinal);
        if (manifest.LogoAsset != null)
        {
            Require(assets.Contains(manifest.LogoAsset) && !manifest.LogoAsset.EndsWith(".mp4")
                && manifest.Assets.Single(item => item.Path == manifest.LogoAsset).Size <= 5_242_880, "El logo no es válido o supera 5 MiB.");
            referenced.Add(manifest.LogoAsset);
        }
        var seriesKeys = manifest.Series.Select(item => item.Key).ToHashSet();
        var seriesIdentities = new HashSet<(string Name, DateOnly StartDate)>();
        var externalIdentities = new HashSet<(string Provider, string Id)>();
        var clipKeys = manifest.Clips.ToDictionary(item => item.Key);
        foreach (var series in manifest.Series)
        {
            Text(series.Name, 300);
            Require(seriesIdentities.Add((series.Name.Trim().ToUpperInvariant(), series.StartDate)), "El paquete repite una serie y su fecha de inicio.");
            OptionalText(series.Description, 20_000);
            Require(series.Seasons is >= 0 and <= 100 && series.ExternalIds is { Count: <= 10 }, "La serie tiene temporadas o identificadores no válidos.");
            foreach (var external in series.ExternalIds)
            {
                Require(external != null && Regex.IsMatch(external.Provider, @"\A[a-z0-9-]{1,80}\z"), "El proveedor de metadatos no es válido.");
                Text(external!.ExternalId, 300);
                Require(externalIdentities.Add((external.Provider, external.ExternalId)), "Varias series comparten el mismo identificador externo.");
            }
            Require(series.ExternalIds.Select(item => item.Provider).Distinct().Count() == series.ExternalIds.Count, "Hay proveedores repetidos en una serie.");
        }
        foreach (var clip in manifest.Clips)
        {
            Text(clip.Title, 300);
            Text(clip.License, 500);
            OptionalText(clip.RegionCode, 20);
            ValidateSource(clip.SourceUrl);
            Require(Enum.IsDefined(clip.Kind) && Enum.IsDefined(clip.Season) && assets.Contains(clip.Asset)
                && clip.Asset.EndsWith(".mp4") && referenced.Add(clip.Asset), "Los medios del anuncio o bumper no son válidos.");
            Require(clip.OriginalYearTo == null || clip.OriginalYearFrom == null || clip.OriginalYearTo >= clip.OriginalYearFrom,
                "La época del archivo no es válida.");
        }
        Require(referenced.SetEquals(assets), "El paquete declara archivos que no utiliza.");
        foreach (var era in manifest.Eras)
        {
            Text(era.Name, 200);
            OptionalText(era.Description, 20_000);
            Require(era.EndDate == null || era.EndDate >= era.StartDate, "Las fechas de la era no son válidas.");
            Require(era.Series is { Count: <= 200 } && era.Clips is { Count: <= 384 }, "La era supera los límites de contenido.");
            foreach (var selection in era.Series)
                Require(selection != null && seriesKeys.Contains(selection.SeriesKey) && selection.Seasons is { Length: <= 100 }
                    && selection.Seasons.All(number => number is >= 0 and <= 100) && selection.Seasons.Distinct().Count() == selection.Seasons.Length,
                    "Las temporadas de la era no son válidas.");
            Require(era.Series.Select(item => item.SeriesKey).Distinct().Count() == era.Series.Count, "La era repite una serie.");
            foreach (var assignment in era.Clips)
                Require(assignment != null && clipKeys.TryGetValue(assignment.ClipKey, out var clip) && Enum.IsDefined(assignment.Role)
                    && clip.Kind == (assignment.Role == BreakRole.Advertisement ? InterludeKind.Advertisement : InterludeKind.Bumper)
                    && assignment.Weight is >= 1 and <= 100 && assignment.MinimumGapSeconds is >= 0 and <= 604800,
                    "La asignación publicitaria no es válida.");
            Require(era.Clips.Select(item => (item.ClipKey, item.Role)).Distinct().Count() == era.Clips.Count, "La era repite una asignación publicitaria.");
            if (era.BreakRules is { } rule)
                Require(rule.MinimumAds >= 1 && rule.MaximumAds >= rule.MinimumAds && rule.MaximumAds <= 12
                    && rule.MaximumBreakSeconds is >= 1 and <= 1800, "Las reglas de publicidad no son válidas.");
        }
        Require(manifest.SelectedEra == null || manifest.Eras.Any(item => item.Key == manifest.SelectedEra), "La era seleccionada no pertenece al paquete.");
    }

    public static void ValidateSource(string? url)
    {
        OptionalText(url, 1000);
        Require(string.IsNullOrWhiteSpace(url) || Uri.TryCreate(url, UriKind.Absolute, out var uri)
            && uri.Scheme is "https" or "http" && string.IsNullOrEmpty(uri.UserInfo), "La fuente debe ser una URL HTTP o HTTPS sin credenciales.");
    }

    public static async Task CopyBoundedAsync(ZipArchiveEntry entry, Stream destination, long limit, CancellationToken token)
    {
        await using var source = entry.Open();
        var buffer = new byte[81920];
        long written = 0;
        int count;
        while ((count = await source.ReadAsync(buffer, token)) != 0)
        {
            written += count;
            Require(written <= limit && written <= entry.Length, "El archivo descomprimido supera el tamaño declarado.");
            await destination.WriteAsync(buffer.AsMemory(0, count), token);
        }
        Require(written == entry.Length, "El archivo está incompleto.");
    }

    public static void Require(bool condition, string message)
    {
        if (!condition) throw new InvalidDataException(message);
    }
    private static void Text(string? value, int max) => Require(!string.IsNullOrWhiteSpace(value) && value.Length <= max && !value.Any(char.IsControl), "Hay un nombre o identificador no válido.");
    private static void OptionalText(string? value, int max) => Require(value == null || value.Length <= max, "Un texto supera el tamaño permitido.");
    private static void Unique(IEnumerable<string?> keys)
    {
        var seen = new HashSet<string>();
        foreach (var key in keys)
            Require(key != null && Regex.IsMatch(key, @"\A[a-z0-9-]{1,80}\z") && seen.Add(key), "Los identificadores del paquete deben ser únicos.");
    }
}
