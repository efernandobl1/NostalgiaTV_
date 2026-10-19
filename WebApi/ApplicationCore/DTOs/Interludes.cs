using System.ComponentModel.DataAnnotations;

namespace ApplicationCore.DTOs;

public sealed record InterludeItem(int Id, string Title, string Kind, string? BumperType, string Season, string FilePath,
    decimal DurationSeconds, bool ApprovedForBroadcast, bool RedistributionAllowed, string? License, string? SourceUrl,
    string? RegionCode, int? OriginalYearFrom, int? OriginalYearTo, int EraCount);

public sealed record InterludeQuery(string? Kind, string? Season, bool? Approved, string? Search);

/// <summary>Metadata of an interlude; the upload form sends the same fields with the MP4 file.</summary>
public sealed record InterludeRequest(
    [StringLength(300)] string? Title,
    [Required] string Kind,
    string? BumperType,
    [Required] string Season,
    bool RedistributionAllowed,
    [StringLength(500)] string? License,
    [StringLength(1000)] string? SourceUrl,
    [StringLength(20)] string? RegionCode,
    [Range(1900, 2100)] int? OriginalYearFrom,
    [Range(1900, 2100)] int? OriginalYearTo) : IValidatableObject
{
    public IEnumerable<ValidationResult> Validate(ValidationContext context)
    {
        if (!Entities.InterludeKind.All.Contains(Kind)) yield return new("Tipo de interludio no válido.", [nameof(Kind)]);
        if (!Entities.InterludeSeason.All.Contains(Season)) yield return new("Temporada no válida.", [nameof(Season)]);
        if (Kind == Entities.InterludeKind.Bumper && !Entities.BumperType.All.Contains(BumperType ?? ""))
            yield return new("Indica si el bumper es «Ya viene», «Continuamos con» o genérico.", [nameof(BumperType)]);
        if (Kind == Entities.InterludeKind.Advertisement && BumperType != null)
            yield return new("Los anuncios no tienen tipo de bumper.", [nameof(BumperType)]);
        if (OriginalYearTo < OriginalYearFrom) yield return new("El rango de años no es válido.", [nameof(OriginalYearTo)]);
        if (RedistributionAllowed && string.IsNullOrWhiteSpace(License))
            yield return new("Indica la licencia o el permiso que autoriza compartir el archivo.", [nameof(License)]);
        if (!string.IsNullOrWhiteSpace(SourceUrl) && (!Uri.TryCreate(SourceUrl, UriKind.Absolute, out var uri)
            || uri.Scheme != Uri.UriSchemeHttps || !string.IsNullOrEmpty(uri.UserInfo)))
            yield return new("La fuente debe ser una URL HTTPS pública.", [nameof(SourceUrl)]);
    }
}

public sealed record ApprovalRequest(bool Approved);
