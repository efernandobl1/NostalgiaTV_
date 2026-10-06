using System.Globalization;
using ApplicationCore.Settings;
using Microsoft.Extensions.Options;

namespace Infrastructure.Services.Media;

public sealed class MediaTranscoder(MediaProbe probe, MediaProcessRunner runner, IOptions<MediaProcessingSettings> settings)
{
    public async Task<string> ConvertAsync(LibraryFile file, Func<double, Task> progress, CancellationToken token)
    {
        var source = await probe.ReadAsync(file.FullPath, token);
        if (source.Compatible) return file.FullPath;
        var output = MediaFilePolicy.OutputPath(file.FullPath);
        if (File.Exists(output)) throw new IOException("Output already exists; no existing video will be overwritten.");
        var prefix = Path.GetFileName(output) + ".transcoding.";
        foreach (var orphan in Directory.EnumerateFiles(Path.GetDirectoryName(output)!))
        {
            var name = Path.GetFileName(orphan);
            if (!name.StartsWith(prefix, StringComparison.Ordinal) || !name.EndsWith(".mp4", StringComparison.Ordinal)) continue;
            var identifier = name[prefix.Length..^4];
            if (Guid.TryParseExact(identifier, "N", out _) && (File.GetAttributes(orphan) & FileAttributes.ReparsePoint) == 0)
                File.Delete(orphan);
        }
        var drive = new DriveInfo(Path.GetPathRoot(file.FullPath)!);
        var required = checked(file.Size * 2 + (long)Math.Max(512, settings.Value.MinimumFreeSpaceMB) * 1024 * 1024);
        if (drive.AvailableFreeSpace < required) throw new IOException("Not enough free space to convert and preserve the original.");
        var reserve = (long)Math.Max(512, settings.Value.MinimumFreeSpaceMB) * 1024 * 1024;
        var outputLimit = (drive.AvailableFreeSpace - reserve).ToString(CultureInfo.InvariantCulture);
        var temporary = output + $".transcoding.{Guid.NewGuid():N}.mp4";
        var timeout = TimeSpan.FromHours(Math.Clamp(settings.Value.ConversionTimeoutHours, 1, 48));
        try
        {
            await runner.RunAsync(probe.Binary("ffmpeg"),
                ["-nostdin", "-hide_banner", "-loglevel", "error", "-n", "-protocol_whitelist", "file,pipe", "-threads", "1",
                 "-i", file.FullPath, "-map", "0:v:0", "-map", "0:a:0?", "-sn", "-dn", "-map_metadata", "-1",
                 "-c:v", "libx264", "-threads", "1", "-preset", "medium", "-crf", "22", "-profile:v", "main", "-level:v", "4.0", "-maxrate", "8M", "-bufsize", "16M",
                 "-filter_threads", "1", "-vf", "scale=w='min(1920,iw)':h='min(1080,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,fps=30",
                 "-pix_fmt", "yuv420p", "-tag:v", "avc1", "-c:a", "aac", "-b:a", "160k", "-ac", "2", "-ar", "48000",
                 "-movflags", "+faststart", "-fs", outputLimit, "-progress", "pipe:1", "-nostats", "-f", "mp4", temporary], timeout, token,
                line =>
                {
                    if (drive.AvailableFreeSpace < reserve) throw new IOException("Free space reserve reached; original preserved.");
                    return Report(line, source.Duration, 0, 90, progress);
                });
            var result = await probe.ReadAsync(temporary, token);
            if (!result.Compatible || !MediaProbe.SameDuration(source.Duration, result.Duration))
                throw new IOException("Converted video failed compatibility or full-duration validation; original preserved.");
            // Decode the complete output before publishing it. A valid container alone does not prove a complete episode.
            await runner.RunAsync(probe.Binary("ffmpeg"),
                ["-nostdin", "-v", "error", "-xerror", "-protocol_whitelist", "file,pipe", "-threads", "1", "-i", temporary,
                 "-map", "0:v:0", "-map", "0:a:0?", "-progress", "pipe:1", "-nostats", "-f", "null", "-"], timeout, token,
                line => Report(line, result.Duration, 90, 9, progress));
            MediaLibraryService.EnsureUnchanged(file);
            token.ThrowIfCancellationRequested();
            File.Move(temporary, output, overwrite: false);
            return output;
        }
        finally
        {
            if (File.Exists(temporary)) File.Delete(temporary);
        }
    }

    private static Task Report(string line, double duration, double offset, double range, Func<double, Task> progress)
    {
        if (line.StartsWith("out_time_us=") && double.TryParse(line[12..], NumberStyles.Float, CultureInfo.InvariantCulture, out var microseconds))
            return progress(Math.Clamp(offset + microseconds / 1000000 / duration * range, offset, offset + range));
        return Task.CompletedTask;
    }
}
