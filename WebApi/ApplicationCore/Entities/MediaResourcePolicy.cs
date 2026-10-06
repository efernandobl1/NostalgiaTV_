namespace ApplicationCore.Entities;

public class MediaResourcePolicy
{
    public int Id { get; set; } = 1;
    public int DayCores { get; set; } = 1;
    public int NightCores { get; set; } = 3;
    public bool NightEnabled { get; set; } = true;
    public int NightStartMinute { get; set; } = 0;
    public int NightEndMinute { get; set; } = 300;
    public string TimeZoneId { get; set; } = "America/Guatemala";
    public int AvailableCores { get; set; }
    public int AppliedCores { get; set; }
    public DateTime? AppliedAtUtc { get; set; }
}
