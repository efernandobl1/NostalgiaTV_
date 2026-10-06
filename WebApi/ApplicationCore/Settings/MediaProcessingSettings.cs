namespace ApplicationCore.Settings;

public class MediaProcessingSettings
{
    public int PollSeconds { get; set; } = 60;
    public int StableAgeSeconds { get; set; } = 120;
    public int MinimumFreeSpaceMB { get; set; } = 512;
    public int ConversionTimeoutHours { get; set; } = 24;
}
