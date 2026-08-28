using FFMpegCore;
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
                var info = await FFProbe.AnalyseAsync(filePath);
                return info.Duration.TotalSeconds;
            }
            catch
            {
                return 1800;
            }
        }
    }
}
