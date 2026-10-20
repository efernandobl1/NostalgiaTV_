using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using ApplicationCore.DTOs;
using ApplicationCore.Entities;
using ApplicationCore.Exceptions;
using ApplicationCore.Interfaces.Repositories;
using ApplicationCore.Models;
using Infrastructure.Media;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories;

/// <summary>
/// Channel packages: export a channel as versioned JSON, preview what an import would create and
/// what the local library is missing, and import it as a new channel. Packages carry references only
/// (series by external id or name, interludes by library path or title), never media files.
/// </summary>
public sealed partial class ChannelPackageRepository(NostalgiaTVContext context, MediaLibrary library, IScheduleRepository schedule)
    : IChannelPackageRepository
{
    private const string Matched = "matched", Missing = "missing", Ambiguous = "ambiguous";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = false,
        NumberHandling = JsonNumberHandling.Strict,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        RespectNullableAnnotations = true,
        RespectRequiredConstructorParameters = true,
        AllowDuplicateProperties = false,
        MaxDepth = 16,
        WriteIndented = true
    };

    // ── Export ──

    public async Task<ChannelPackageFile> ExportAsync(int channelId)
    {
        var channel = await context.Channels.AsNoTracking().SingleOrDefaultAsync(item => item.Id == channelId)
            ?? throw new NotFoundException("Canal no encontrado.");
        var active = await context.ChannelEraSelections.Where(selection => selection.ChannelId == channelId)
            .Select(selection => (int?)selection.ChannelEraId).FirstOrDefaultAsync();
        var eras = await context.ChannelEras.AsNoTracking().Where(era => era.ChannelId == channelId)
            .OrderBy(era => era.HistoricalStartDate).ThenBy(era => era.Id)
            .Select(era => new
            {
                era.Id, era.Name, era.Description, era.HistoricalStartDate, era.HistoricalEndDate,
                Rule = era.BreakRule == null ? null : new PackageBreakRule(era.BreakRule.MinimumAds, era.BreakRule.MaximumAds, era.BreakRule.MaximumBreakSeconds)
            }).ToListAsync();
        var eraIds = eras.Select(era => era.Id).ToList();
        var lineups = await context.ChannelEraSeries.AsNoTracking()
            .Where(link => eraIds.Contains(link.ChannelEraId) && link.Series.DeletedAtUtc == null)
            .Select(link => new
            {
                link.ChannelEraId, link.SeriesId, link.Series.Name,
                Seasons = link.SelectedSeasons.OrderBy(season => season.SeasonNumber).Select(season => season.SeasonNumber).ToList()
            }).ToListAsync();
        var assignments = (await context.ChannelEraInterludes.AsNoTracking()
                .Where(link => eraIds.Contains(link.ChannelEraId) && link.Interlude.DeletedAtUtc == null)
                .Select(link => new { link.ChannelEraId, SeriesId = (int?)null, link.InterludeId, link.Weight, link.MinimumGapSeconds }).ToListAsync())
            .Concat(await context.ChannelEraSeriesInterludes.AsNoTracking()
                .Where(link => eraIds.Contains(link.ChannelEraId) && link.Interlude.DeletedAtUtc == null && link.ChannelEraSeries.Series.DeletedAtUtc == null)
                .Select(link => new { link.ChannelEraId, SeriesId = (int?)link.SeriesId, link.InterludeId, link.Weight, link.MinimumGapSeconds }).ToListAsync())
            .ToList();

        var seriesIds = lineups.Select(link => link.SeriesId).Distinct().ToList();
        var series = await context.Series.AsNoTracking().Where(item => seriesIds.Contains(item.Id)).OrderBy(item => item.Name).ThenBy(item => item.Id)
            .Select(item => new { item.Id, item.Name, item.StartDate }).ToListAsync();
        var externals = (await context.SeriesExternalIds.AsNoTracking().Where(link => seriesIds.Contains(link.SeriesId))
                .OrderBy(link => link.Provider.Code)
                .Select(link => new { link.SeriesId, link.Provider.Code, link.ExternalId }).ToListAsync())
            .ToLookup(link => link.SeriesId, link => new PackageExternalId(link.Code, link.ExternalId));
        var interludeIds = assignments.Select(link => link.InterludeId).Distinct().ToList();
        var interludes = await context.Interludes.AsNoTracking().Where(item => interludeIds.Contains(item.Id))
            .OrderBy(item => item.Kind).ThenBy(item => item.Title).ThenBy(item => item.Id).ToListAsync();

        var seriesKeys = series.Select((item, index) => (item.Id, Key: $"series-{index + 1}")).ToDictionary(item => item.Id, item => item.Key);
        var interludeKeys = interludes.Select((item, index) => (item.Id, Key: $"interlude-{index + 1}")).ToDictionary(item => item.Id, item => item.Key);
        var package = new ChannelPackage(ChannelPackage.FormatName, ChannelPackage.CurrentVersion, DateTime.UtcNow,
            new PackageChannel(channel.ShareId, channel.Name, channel.History, channel.StartDate, channel.EndDate),
            series.Select(item => new PackageSeries(seriesKeys[item.Id], item.Name, item.StartDate, externals[item.Id].ToList())).ToList(),
            interludes.Select(item => new PackageInterlude(interludeKeys[item.Id], item.Title, item.Kind, item.BumperType, item.Season, item.FilePath)).ToList(),
            eras.Select(era => new PackageEra(era.Name, era.Description, era.HistoricalStartDate, era.HistoricalEndDate, era.Id == active, era.Rule,
                lineups.Where(link => link.ChannelEraId == era.Id).OrderBy(link => link.Name)
                    .Select(link => new PackageEraSeries(seriesKeys[link.SeriesId], link.Seasons)).ToList(),
                assignments.Where(link => link.ChannelEraId == era.Id)
                    .OrderBy(link => link.SeriesId.HasValue).ThenBy(link => link.SeriesId == null ? "" : seriesKeys[link.SeriesId.Value])
                    .ThenBy(link => interludeKeys[link.InterludeId], StringComparer.Ordinal)
                    .Select(link => new PackageEraInterlude(interludeKeys[link.InterludeId], link.SeriesId == null ? null : seriesKeys[link.SeriesId.Value],
                        link.Weight, link.MinimumGapSeconds)).ToList())).ToList());

        // The exported file must be importable: it goes through the same validation as an upload.
        Validate(package);
        var content = JsonSerializer.SerializeToUtf8Bytes(package, Json);
        Require(content.Length <= ChannelPackage.MaxBytes, "El canal es demasiado grande para exportarlo en un paquete de 1 MiB.");
        return new ChannelPackageFile(Slug(channel.Name) + ".ntv.json", content);
    }

    // ── Preview ──

    public async Task<ChannelPackagePreview> PreviewAsync(FileUpload file, CancellationToken token)
    {
        var plan = await PlanAsync(await ReadAsync(file, token), token);
        var package = plan.Package;
        var name = package.Channel.Name.Trim();
        var sourceId = await context.Channels.Where(channel => channel.ShareId == package.Channel.ShareId)
            .Select(channel => (int?)channel.Id).FirstOrDefaultAsync(token);
        return new ChannelPackagePreview(package.Version, name, await context.Channels.AnyAsync(channel => channel.Name == name, token), sourceId,
            plan.Eras.Select(era => new PackagePreviewEra(era.Source.Name.Trim(), era.Source.HistoricalStartDate.Year, era.Source.HistoricalEndDate?.Year,
                era.Source.OnAir, era.Source.BreakRule, era.Series.Count, era.MissingSeries, era.Interludes.Count, era.MissingInterludes)).ToList(),
            package.Series.Select(series =>
            {
                var match = plan.Series[series.Key];
                return new PackagePreviewSeries(series.Key, series.Name.Trim(), series.StartDate.Year, match.Status, match.Id, match.By,
                    plan.MissingSeasons.GetValueOrDefault(series.Key) ?? []);
            }).ToList(),
            package.Interludes.Select(interlude =>
            {
                var match = plan.Interludes[interlude.Key];
                return new PackagePreviewInterlude(interlude.Key, interlude.Title.Trim(), interlude.Kind, interlude.BumperType, match.Status, match.Id, match.By);
            }).ToList());
    }

    // ── Import ──

    public async Task<ChannelPackageImportResult> ImportAsync(FileUpload file, string? name, CancellationToken token)
    {
        var plan = await PlanAsync(await ReadAsync(file, token), token);
        var source = plan.Package.Channel;
        var channelName = string.IsNullOrWhiteSpace(name) ? source.Name.Trim() : name.Trim();
        Text(channelName, 200, "El nombre del canal");

        Channel channel;
        await using (var transaction = await context.Database.BeginTransactionAsync(token))
        {
            if (await context.Channels.AnyAsync(item => item.Name == channelName, token))
                throw new ConflictException($"Ya existe un canal llamado «{channelName}». Elige otro nombre para importarlo.");
            // Importing a copy into the library it came from keeps the original's public ShareId untouched.
            var shareTaken = await context.Channels.IgnoreQueryFilters().AnyAsync(item => item.ShareId == source.ShareId, token);
            channel = new Channel
            {
                ShareId = shareTaken ? Guid.NewGuid() : source.ShareId, Name = channelName,
                History = string.IsNullOrWhiteSpace(source.History) ? null : source.History.Trim(), StartDate = source.StartDate, EndDate = source.EndDate
            };
            foreach (var item in plan.Eras)
            {
                var era = new ChannelEra
                {
                    Channel = channel, Name = item.Source.Name.Trim(),
                    Description = string.IsNullOrWhiteSpace(item.Source.Description) ? null : item.Source.Description.Trim(),
                    HistoricalStartDate = item.Source.HistoricalStartDate, HistoricalEndDate = item.Source.HistoricalEndDate,
                    BreakRule = item.Source.BreakRule is { } rule
                        ? new ChannelEraBreakRule { MinimumAds = rule.MinimumAds, MaximumAds = rule.MaximumAds, MaximumBreakSeconds = rule.MaximumBreakSeconds }
                        : null
                };
                var links = item.Series.ToDictionary(lineup => lineup.SeriesId, lineup => new ChannelEraSeries
                {
                    ChannelEra = era, SeriesId = lineup.SeriesId,
                    SelectedSeasons = lineup.Seasons.Select(number => new ChannelEraSelectedSeason { SeasonNumber = number }).ToList()
                });
                foreach (var link in links.Values) era.Series.Add(link);
                foreach (var assignment in item.Interludes)
                {
                    if (assignment.SeriesId is int seriesId)
                        links[seriesId].Interludes.Add(new ChannelEraSeriesInterlude
                            { InterludeId = assignment.InterludeId, Weight = assignment.Weight, MinimumGapSeconds = assignment.MinimumGapSeconds });
                    else
                        era.Interludes.Add(new ChannelEraInterlude
                            { InterludeId = assignment.InterludeId, Weight = assignment.Weight, MinimumGapSeconds = assignment.MinimumGapSeconds });
                }
                channel.Eras.Add(era);
            }
            context.Channels.Add(channel);
            await context.SaveChangesAsync(token);
            if (plan.Eras.FindIndex(item => item.Source.OnAir) is var onAir and >= 0)
            {
                context.ChannelEraSelections.Add(new ChannelEraSelection
                    { ChannelId = channel.Id, ChannelEraId = channel.Eras.ElementAt(onAir).Id, SelectedAtUtc = DateTime.UtcNow });
                await context.SaveChangesAsync(token);
            }
            await transaction.CommitAsync(token);
        }

        library.CreateFolder(MediaStorageLayout.ChannelFolder(channel.Id));
        foreach (var era in channel.Eras)
        {
            era.FolderPath = MediaStorageLayout.EraFolder(channel.Id, era.Id);
            library.CreateFolder(era.FolderPath);
        }
        await context.SaveChangesAsync(token);
        if (plan.Eras.Any(item => item.Source.OnAir)) await schedule.RegenerateAsync(channel.Id, replaceCurrent: true, token);

        return new ChannelPackageImportResult(channel.Id, channel.Name, plan.Eras.Count,
            plan.Eras.Sum(era => era.Series.Count), plan.Eras.Sum(era => era.MissingSeries),
            plan.Eras.Sum(era => era.Interludes.Count), plan.Eras.Sum(era => era.MissingInterludes));
    }

    // ── Reading and validation ──

    private static async Task<ChannelPackage> ReadAsync(FileUpload file, CancellationToken token)
    {
        Require(file.Length is > 0 and <= ChannelPackage.MaxBytes && file.FileName.EndsWith(".json", StringComparison.OrdinalIgnoreCase),
            "Selecciona un paquete .ntv.json de hasta 1 MiB.");
        byte[] bytes;
        await using (var stream = file.OpenReadStream())
        using (var buffer = new MemoryStream())
        {
            var chunk = new byte[16384];
            int read;
            while ((read = await stream.ReadAsync(chunk, token)) > 0)
            {
                Require(buffer.Length + read <= ChannelPackage.MaxBytes, "Selecciona un paquete .ntv.json de hasta 1 MiB.");
                buffer.Write(chunk, 0, read);
            }
            bytes = buffer.ToArray();
        }
        var content = bytes.AsMemory();
        if (content.Span.StartsWith("﻿"u8)) content = content[3..];

        // Format and version first, so a newer package says so instead of failing on an unknown field.
        try
        {
            using var document = JsonDocument.Parse(content, new JsonDocumentOptions { MaxDepth = 16 });
            var root = document.RootElement;
            Require(root.ValueKind == JsonValueKind.Object && root.TryGetProperty("format", out var format)
                && format.ValueKind == JsonValueKind.String && format.GetString() == ChannelPackage.FormatName,
                "El archivo no es un paquete de canal de NostalgiaTV.");
            Require(root.TryGetProperty("version", out var version) && version.ValueKind == JsonValueKind.Number,
                "El paquete no indica su versión.");
            Require(version.TryGetInt32(out var number) && number == ChannelPackage.CurrentVersion,
                $"Esta instalación lee paquetes de la versión {ChannelPackage.CurrentVersion}; el archivo es de la versión {version.GetRawText()}.");
        }
        catch (JsonException) { throw new BadRequestException("El archivo no es un JSON válido."); }

        ChannelPackage? package;
        try { package = JsonSerializer.Deserialize<ChannelPackage>(content.Span, Json); }
        catch (JsonException error)
        {
            throw new BadRequestException($"El paquete no cumple el formato de la versión {ChannelPackage.CurrentVersion}"
                + (string.IsNullOrEmpty(error.Path) ? "." : $" (revisa {error.Path})."));
        }
        Require(package is not null, "El paquete está vacío.");
        Validate(package!);
        return package!;
    }

    private static void Validate(ChannelPackage package)
    {
        var channel = package.Channel;
        Require(package.Format == ChannelPackage.FormatName && package.Version == ChannelPackage.CurrentVersion, "La versión del paquete no es compatible.");
        Require(channel.ShareId != Guid.Empty, "El paquete no identifica su canal.");
        Text(channel.Name, 200, "El nombre del canal");
        Optional(channel.History, 20000, "La historia del canal");
        Require(channel.EndDate == null || channel.EndDate >= channel.StartDate, "La fecha de cierre del canal es anterior a su inicio.");
        Require(package.Series.Count <= 500 && package.Interludes.Count <= 2000 && package.Eras.Count <= 50,
            "El paquete supera los límites: 50 eras, 500 series y 2000 interludios.");

        var seriesKeys = Keys(package.Series.Select(item => item?.Key), "series");
        foreach (var series in package.Series)
        {
            Text(series.Name, 300, "El nombre de una serie");
            Require(series.ExternalIds.Count <= 10 && series.ExternalIds.All(external => external is not null), "Una serie tiene identificadores externos no válidos.");
            foreach (var external in series.ExternalIds)
            {
                Require(ProviderCode().IsMatch(external.Provider), "Un proveedor de metadatos no es válido.");
                Text(external.Id, 300, "Un identificador externo");
            }
            Require(series.ExternalIds.Select(external => external.Provider).Distinct().Count() == series.ExternalIds.Count,
                $"La serie «{series.Name}» repite un proveedor de metadatos.");
        }

        var interludeKeys = Keys(package.Interludes.Select(item => item?.Key), "interlude");
        foreach (var interlude in package.Interludes)
        {
            Text(interlude.Title, 300, "El título de un interludio");
            Require(InterludeKind.All.Contains(interlude.Kind) && InterludeSeason.All.Contains(interlude.Season)
                && (interlude.BumperType == null || interlude.Kind == InterludeKind.Bumper && BumperType.All.Contains(interlude.BumperType)),
                $"El interludio «{interlude.Title}» tiene un tipo o temporada no válidos.");
            LibraryPath(interlude.FilePath);
        }

        Require(package.Eras.All(era => era is not null), "El paquete contiene una era vacía.");
        Require(package.Eras.Select(era => era.Name?.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).Count() == package.Eras.Count,
            "El paquete repite el nombre de una era.");
        Require(package.Eras.Count(era => era.OnAir) <= 1, "Solo una era puede estar en emisión.");
        foreach (var era in package.Eras)
        {
            Text(era.Name, 200, "El nombre de una era");
            Optional(era.Description, 4000, $"La descripción de la era «{era.Name}»");
            Require(era.HistoricalEndDate == null || era.HistoricalEndDate >= era.HistoricalStartDate, $"Las fechas de la era «{era.Name}» no son válidas.");
            if (era.BreakRule is { } rule)
                Require(rule.MinimumAds is >= 1 and <= 12 && rule.MaximumAds is >= 1 and <= 12 && rule.MaximumAds >= rule.MinimumAds
                    && rule.MaximumBreakSeconds is >= 1 and <= 1800, $"Las reglas de corte de la era «{era.Name}» no son válidas.");
            Require(era.Series.Count <= 500 && era.Interludes.Count <= 2000, $"La era «{era.Name}» supera los límites de contenido.");
            foreach (var lineup in era.Series)
                Require(lineup is not null && seriesKeys.Contains(lineup.Series) && lineup.Seasons.Count <= 200
                    && lineup.Seasons.All(number => number is >= 0 and <= 999) && lineup.Seasons.Distinct().Count() == lineup.Seasons.Count,
                    $"Las series de la era «{era.Name}» no son válidas.");
            Require(era.Series.Select(lineup => lineup.Series).Distinct().Count() == era.Series.Count, $"La era «{era.Name}» repite una serie.");
            var lineupKeys = era.Series.Select(lineup => lineup.Series).ToHashSet();
            foreach (var assignment in era.Interludes)
                Require(assignment is not null && interludeKeys.Contains(assignment.Interlude)
                    && (assignment.Series == null || lineupKeys.Contains(assignment.Series))
                    && assignment.Weight is >= 1 and <= 100 && assignment.MinimumGapSeconds is >= 0 and <= 604800,
                    $"Los interludios de la era «{era.Name}» no son válidos.");
            Require(era.Interludes.Select(assignment => (assignment.Interlude, assignment.Series)).Distinct().Count() == era.Interludes.Count,
                $"La era «{era.Name}» repite un interludio.");
        }
    }

    /// <summary>Only "/uploads/..." paths that stay inside the media library; the file itself may be absent.</summary>
    private static void LibraryPath(string path)
    {
        const string message = "Un interludio apunta a una ruta fuera de la biblioteca de medios.";
        Require(path.Length is > 0 and <= 1000 && path.StartsWith(MediaLibrary.PublicPrefix, StringComparison.Ordinal)
            && !path.Any(character => char.IsControl(character) || character is '\\' or ':' or '*' or '?' or '"' or '<' or '>' or '|'), message);
        var segments = path[MediaLibrary.PublicPrefix.Length..].Split('/');
        Require(segments.All(segment => segment.Length > 0 && segment.Trim('.', ' ').Length > 0 && segment == segment.Trim()), message);
    }

    // ── Matching against the local library ──

    private sealed record Match(string Status, int? Id, string? By);
    private sealed record EraLineup(int SeriesId, IReadOnlyList<int> Seasons);
    private sealed record EraAssignment(int InterludeId, int? SeriesId, int Weight, int MinimumGapSeconds);
    private sealed record EraPlan(PackageEra Source, List<EraLineup> Series, List<EraAssignment> Interludes, int MissingSeries, int MissingInterludes);
    private sealed record Plan(ChannelPackage Package, Dictionary<string, Match> Series, Dictionary<string, Match> Interludes,
        Dictionary<string, IReadOnlyList<int>> MissingSeasons, List<EraPlan> Eras);

    private async Task<Plan> PlanAsync(ChannelPackage package, CancellationToken token)
    {
        var series = await MatchSeriesAsync(package.Series, token);
        var interludes = await MatchInterludesAsync(package.Interludes, token);
        var matchedIds = series.Values.Where(match => match.Id != null).Select(match => match.Id!.Value).Distinct().ToList();
        var seasons = (await context.SeriesSeasons.AsNoTracking().Where(season => matchedIds.Contains(season.SeriesId))
                .Select(season => new { season.SeriesId, season.SeasonNumber }).ToListAsync(token))
            .ToLookup(season => season.SeriesId, season => season.SeasonNumber);

        var missingSeasons = new Dictionary<string, SortedSet<int>>();
        var eras = new List<EraPlan>();
        foreach (var era in package.Eras)
        {
            var lineups = new List<EraLineup>();
            var linked = new Dictionary<string, int>();
            foreach (var lineup in era.Series)
            {
                if (series[lineup.Series].Id is not int seriesId) continue;
                var local = seasons[seriesId].ToHashSet();
                var absent = lineup.Seasons.Where(number => !local.Contains(number)).ToList();
                if (absent.Count > 0)
                {
                    if (!missingSeasons.TryGetValue(lineup.Series, out var set)) missingSeasons[lineup.Series] = set = [];
                    set.UnionWith(absent);
                }
                // A filter whose seasons do not exist here would otherwise widen to "every season".
                var kept = lineup.Seasons.Where(local.Contains).Order().ToList();
                if (lineup.Seasons.Count > 0 && kept.Count == 0) continue;
                lineups.Add(new EraLineup(seriesId, kept));
                linked[lineup.Series] = seriesId;
            }
            var assignments = new List<EraAssignment>();
            foreach (var assignment in era.Interludes)
            {
                if (interludes[assignment.Interlude].Id is not int interludeId) continue;
                int? seriesId = null;
                if (assignment.Series != null)
                {
                    if (!linked.TryGetValue(assignment.Series, out var id)) continue;
                    seriesId = id;
                }
                // Two package entries can resolve to the same local interlude: keep the first.
                if (assignments.Any(item => item.InterludeId == interludeId && item.SeriesId == seriesId)) continue;
                assignments.Add(new EraAssignment(interludeId, seriesId, assignment.Weight, assignment.MinimumGapSeconds));
            }
            eras.Add(new EraPlan(era, lineups, assignments, era.Series.Count - lineups.Count, era.Interludes.Count - assignments.Count));
        }
        return new Plan(package, series, interludes,
            missingSeasons.ToDictionary(item => item.Key, item => (IReadOnlyList<int>)item.Value.ToList()), eras);
    }

    /// <summary>External ids first; then a unique name, or name plus start date when several series share it.</summary>
    private async Task<Dictionary<string, Match>> MatchSeriesAsync(IReadOnlyList<PackageSeries> series, CancellationToken token)
    {
        var values = series.SelectMany(item => item.ExternalIds).Select(external => external.Id).Distinct().ToList();
        var known = await context.SeriesExternalIds.AsNoTracking()
            .Where(link => values.Contains(link.ExternalId) && link.Series.DeletedAtUtc == null && link.Provider.DeletedAtUtc == null)
            .Select(link => new { link.SeriesId, link.Provider.Code, link.ExternalId }).ToListAsync(token);
        var names = series.Select(item => item.Name.Trim()).Distinct().ToList();
        var byName = await context.Series.AsNoTracking().Where(item => names.Contains(item.Name))
            .Select(item => new { item.Id, item.Name, item.StartDate }).ToListAsync(token);

        var result = new Dictionary<string, Match>();
        var used = new HashSet<int>();
        foreach (var item in series)
        {
            var external = item.ExternalIds
                .SelectMany(id => known.Where(link => link.Code == id.Provider && link.ExternalId == id.Id).Select(link => link.SeriesId))
                .Distinct().ToList();
            var name = item.Name.Trim();
            var candidates = byName.Where(local => string.Equals(local.Name.Trim(), name, StringComparison.OrdinalIgnoreCase)).ToList();
            if (candidates.Count > 1) candidates = candidates.Where(local => local.StartDate == item.StartDate).ToList();
            var match = external.Count switch
            {
                1 => new Match(Matched, external[0], "externalId"),
                > 1 => new Match(Ambiguous, null, null),
                _ => candidates.Count switch
                {
                    1 => new Match(Matched, candidates[0].Id, "name"),
                    0 => new Match(Missing, null, null),
                    _ => new Match(Ambiguous, null, null)
                }
            };
            // Two package series cannot share one local series: the later one is reported instead of merged.
            if (match.Id is int id && !used.Add(id)) match = new Match(Ambiguous, null, null);
            result[item.Key] = match;
        }
        return result;
    }

    /// <summary>The library path first; then title, kind and bumper type (and season on ties).</summary>
    private async Task<Dictionary<string, Match>> MatchInterludesAsync(IReadOnlyList<PackageInterlude> interludes, CancellationToken token)
    {
        var paths = interludes.Select(item => item.FilePath).Distinct().ToList();
        var titles = interludes.Select(item => item.Title.Trim()).Distinct().ToList();
        var local = await context.Interludes.AsNoTracking().Where(item => paths.Contains(item.FilePath) || titles.Contains(item.Title))
            .Select(item => new { item.Id, item.Title, item.Kind, item.BumperType, item.Season, item.FilePath }).ToListAsync(token);

        var result = new Dictionary<string, Match>();
        foreach (var item in interludes)
        {
            var byPath = local.Where(candidate => string.Equals(candidate.FilePath, item.FilePath, StringComparison.OrdinalIgnoreCase))
                .OrderBy(candidate => candidate.Id).FirstOrDefault();
            if (byPath != null)
            {
                result[item.Key] = new Match(Matched, byPath.Id, "filePath");
                continue;
            }
            var title = item.Title.Trim();
            var candidates = local.Where(candidate => string.Equals(candidate.Title.Trim(), title, StringComparison.OrdinalIgnoreCase)
                && candidate.Kind == item.Kind && candidate.BumperType == item.BumperType).ToList();
            if (candidates.Count > 1) candidates = candidates.Where(candidate => candidate.Season == item.Season).ToList();
            result[item.Key] = candidates.Count switch
            {
                1 => new Match(Matched, candidates[0].Id, "title"),
                0 => new Match(Missing, null, null),
                _ => new Match(Ambiguous, null, null)
            };
        }
        return result;
    }

    // ── Helpers ──

    private static void Require(bool condition, string message)
    {
        if (!condition) throw new BadRequestException(message);
    }

    private static void Text(string? value, int max, string field) =>
        Require(!string.IsNullOrWhiteSpace(value) && value.Trim().Length <= max && !value.Any(char.IsControl),
            $"{field} está vacío, supera {max} caracteres o contiene caracteres de control.");

    private static void Optional(string? value, int max, string field) =>
        Require(value == null || value.Length <= max, $"{field} supera {max} caracteres.");

    private static HashSet<string> Keys(IEnumerable<string?> keys, string kind)
    {
        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var key in keys)
            Require(key != null && PackageKey().IsMatch(key) && seen.Add(key), $"Las claves de {kind} del paquete deben ser únicas (a-z, 0-9, guiones).");
        return seen;
    }

    private static string Slug(string name)
    {
        var builder = new StringBuilder();
        foreach (var character in name.Normalize(NormalizationForm.FormD))
        {
            if (CharUnicodeInfo.GetUnicodeCategory(character) == UnicodeCategory.NonSpacingMark) continue;
            var lower = char.ToLowerInvariant(character);
            builder.Append(lower is >= 'a' and <= 'z' or >= '0' and <= '9' ? lower : '-');
        }
        var slug = DashRun().Replace(builder.ToString(), "-").Trim('-');
        return slug.Length == 0 ? "canal" : slug[..Math.Min(slug.Length, 60)].TrimEnd('-');
    }

    [GeneratedRegex(@"\A[a-z0-9-]{1,40}\z")]
    private static partial Regex PackageKey();

    [GeneratedRegex(@"\A[a-z0-9_-]{1,50}\z")]
    private static partial Regex ProviderCode();

    [GeneratedRegex("-{2,}")]
    private static partial Regex DashRun();
}
