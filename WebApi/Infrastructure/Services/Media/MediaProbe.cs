using System.Globalization;
using System.Text.Json;
using Microsoft.Extensions.Configuration;

namespace Infrastructure.Services.Media;

public sealed record MediaInfo(double Duration, bool Compatible);

public sealed class MediaProbe(MediaProcessRunner runner, IConfiguration configuration)
{
    public string Binary(string name) => Path.Combine(configuration["FFmpeg:BinaryFolder"] ?? "", name + (OperatingSystem.IsWindows() ? ".exe" : ""));

    public async Task<MediaInfo> ReadAsync(string path, CancellationToken cancellationToken)
    {
        var json = await runner.RunAsync(Binary("ffprobe"),
            ["-v", "error", "-protocol_whitelist", "file,pipe", "-show_streams", "-show_format", "-of", "json", path],
            TimeSpan.FromSeconds(60), cancellationToken);
        return Parse(json, Path.GetExtension(path));
    }

    public static MediaInfo Parse(string json, string extension)
    {
        try { return ParseCore(json, extension); }
        catch (Exception exception) when (exception is JsonException or KeyNotFoundException or InvalidOperationException or FormatException)
        { throw new IOException("Video metadata is invalid or incomplete.", exception); }
    }

    private static MediaInfo ParseCore(string json, string extension)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        var duration = double.Parse(root.GetProperty("format").GetProperty("duration").GetString()!, CultureInfo.InvariantCulture);
        if (!double.IsFinite(duration) || duration <= 0) throw new IOException("Video duration is invalid.");
        var streams = root.GetProperty("streams").EnumerateArray().ToArray();
        var videos = streams.Where(item => item.GetProperty("codec_type").GetString() == "video" &&
            (!item.TryGetProperty("disposition", out var disposition) || !disposition.TryGetProperty("attached_pic", out var attached) || attached.GetInt32() == 0)).ToArray();
        if (videos.Length == 0) throw new IOException("No video stream found.");
        var video = videos[0];
        var rateParts = video.GetProperty("avg_frame_rate").GetString()!.Split('/');
        var rate = rateParts.Length == 2 && double.TryParse(rateParts[0], CultureInfo.InvariantCulture, out var numerator) &&
            double.TryParse(rateParts[1], CultureInfo.InvariantCulture, out var denominator) && denominator > 0 ? numerator / denominator : 0;
        var compatible = extension.Equals(".mp4", StringComparison.OrdinalIgnoreCase) &&
            root.GetProperty("format").GetProperty("format_name").GetString()!.Split(',').Contains("mp4") &&
            videos.Length == 1 && rate > 0 && rate <= 30.1 && video.GetProperty("codec_name").GetString() == "h264" &&
            video.GetProperty("pix_fmt").GetString() == "yuv420p" &&
            video.TryGetProperty("level", out var level) && level.GetInt32() <= 40 &&
            video.GetProperty("width").GetInt32() <= 1920 && video.GetProperty("height").GetInt32() <= 1080 &&
            streams.Where(item => item.GetProperty("codec_type").GetString() == "audio").All(item =>
                item.GetProperty("codec_name").GetString() == "aac" && item.GetProperty("channels").GetInt32() <= 2 &&
                item.TryGetProperty("profile", out var profile) && profile.GetString() == "LC");
        return new MediaInfo(duration, compatible);
    }

    public static bool SameDuration(double source, double output) =>
        double.IsFinite(source) && double.IsFinite(output) && source > 0 && output > 0 &&
        Math.Abs(source - output) <= Math.Max(2, source * 0.005);
}
