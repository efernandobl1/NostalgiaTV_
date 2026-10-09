using System.ComponentModel.DataAnnotations;

namespace ApplicationCore.Settings;

public class PlatformSettingsValues : IValidatableObject
{
    public bool SeasonalThemesEnabled { get; set; } = true;
    public bool SeasonalEffectsEnabled { get; set; } = true;
    public bool SeasonalEpisodesEnabled { get; set; } = true;
    public bool SeasonalInterludesEnabled { get; set; } = true;
    [Required, StringLength(100)]
    public string TimeZoneId { get; set; } = "America/Guatemala";
    [Range(0, 72)]
    public int NoRepeatWindowHours { get; set; } = 24;
    [Range(0, 50)]
    public int MaxSpecialsPerSeriesPerDay { get; set; } = 2;
    [Range(0, 50)]
    public int MaxSpecialsPerDay { get; set; } = 5;
    [Range(0, 20)]
    public int MaxMoviesPerSeriesPerDay { get; set; } = 2;
    [Range(0, 20)]
    public int MaxMoviesPerDay { get; set; } = 2;

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

    public ChannelSchedulingSettings ToSchedulingRules() => new()
    {
        TimeZoneId = TimeZoneId,
        SeasonalEpisodesEnabled = SeasonalEpisodesEnabled,
        SeasonalInterludesEnabled = SeasonalInterludesEnabled,
        NoRepeatWindowHours = NoRepeatWindowHours,
        MaxSpecialsPerSeriesPerDay = MaxSpecialsPerSeriesPerDay,
        MaxSpecialsPerDay = MaxSpecialsPerDay,
        MaxMoviesPerSeriesPerDay = MaxMoviesPerSeriesPerDay,
        MaxMoviesPerDay = MaxMoviesPerDay
    };
}
