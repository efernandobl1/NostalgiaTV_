using FFMpegCore;
using Infrastructure.Services.Media;
using System.Globalization;
using System;
using System.Collections.Generic;
using System.Text;

namespace Infrastructure.Helpers
{
    public static class VideoHelper
    {
        public static async Task<double> GetVideoDurationAsync(string filePath)
        {
            try
            {
                var binary = Path.Combine(GlobalFFOptions.Current.BinaryFolder,
                    OperatingSystem.IsWindows() ? "ffprobe.exe" : "ffprobe");
                var output = await new MediaProcessRunner().RunAsync(binary,
                    ["-v", "error", "-protocol_whitelist", "file,pipe", "-show_entries", "format=duration",
                     "-of", "default=noprint_wrappers=1:nokey=1", filePath], TimeSpan.FromSeconds(15), CancellationToken.None);
                var duration = double.Parse(output.Trim(), CultureInfo.InvariantCulture);
                return double.IsFinite(duration) && duration > 0 ? duration : 1800;
            }
            catch
            {
                return 1800;
            }
        }
    }
}
