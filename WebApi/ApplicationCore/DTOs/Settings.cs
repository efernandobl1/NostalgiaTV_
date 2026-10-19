using System.ComponentModel.DataAnnotations;

namespace ApplicationCore.DTOs;

/// <summary>Editable platform rules (Ajustes). Mirrors CK_PlatformSettings_Limits.</summary>
public sealed record PlatformSettingsRequest(
    [Required, StringLength(100)] string TimeZoneId,
    [Range(1, int.MaxValue)] int ViewerRoleId,
    bool PublicRegistrationEnabled,
    [Range(0, 72)] int NoRepeatWindowHours,
    [Range(0, 50)] int MaxSpecialsPerDay,
    [Range(0, 50)] int MaxSpecialsPerSeriesPerDay,
    [Range(0, 20)] int MaxMoviesPerDay,
    [Range(0, 20)] int MaxMoviesPerSeriesPerDay,
    bool SeasonalEffectsEnabled,
    bool SeasonalEpisodesEnabled,
    bool SeasonalInterludesEnabled,
    bool SeasonalThemesEnabled) : IValidatableObject
{
    public IEnumerable<ValidationResult> Validate(ValidationContext context)
    {
        if (string.IsNullOrWhiteSpace(TimeZoneId) || !TimeZoneInfo.TryFindSystemTimeZoneById(TimeZoneId, out _))
            yield return new("Selecciona una zona horaria válida.", [nameof(TimeZoneId)]);
        else if (TimeZoneId != "UTC" && !TimeZoneInfo.TryConvertIanaIdToWindowsId(TimeZoneId, out _))
            yield return new("Usa una zona IANA, como America/Guatemala, o UTC.", [nameof(TimeZoneId)]);
        if (MaxSpecialsPerSeriesPerDay > MaxSpecialsPerDay)
            yield return new("El límite por serie no puede superar el límite diario de especiales.", [nameof(MaxSpecialsPerSeriesPerDay)]);
        if (MaxMoviesPerSeriesPerDay > MaxMoviesPerDay)
            yield return new("El límite por serie no puede superar el límite diario de películas.", [nameof(MaxMoviesPerSeriesPerDay)]);
    }
}

public sealed record PlatformSettingsResponse(string TimeZoneId, int ViewerRoleId, bool PublicRegistrationEnabled,
    int NoRepeatWindowHours, int MaxSpecialsPerDay, int MaxSpecialsPerSeriesPerDay, int MaxMoviesPerDay, int MaxMoviesPerSeriesPerDay,
    bool SeasonalEffectsEnabled, bool SeasonalEpisodesEnabled, bool SeasonalInterludesEnabled, bool SeasonalThemesEnabled);

/// <summary>What the public site needs to theme itself (seasonal banner and effects).</summary>
public sealed record PublicSettingsResponse(string TimeZoneId, string Season, bool SeasonalThemesEnabled, bool SeasonalEffectsEnabled, bool RegistrationEnabled);

public sealed record CatalogItem(int Id, string Name, int UsageCount);

public sealed record CatalogItemRequest([Required, StringLength(100, MinimumLength = 1)] string Name);

public sealed record MetadataProviderItem(int Id, string Code, string Name, int SeriesCount);

public sealed record MetadataProviderRequest(
    [Required, StringLength(80), RegularExpression(@"^[a-z0-9-]{1,80}$")] string Code,
    [Required, StringLength(200)] string Name);
