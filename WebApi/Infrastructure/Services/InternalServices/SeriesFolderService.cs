using ApplicationCore.Settings;
using Microsoft.Extensions.Options;
using Infrastructure.Services.Media;

namespace Infrastructure.Services.InternalServices
{
    public class SeriesFolderService
    {
        private readonly MediaSettings _settings;

        public SeriesFolderService(IOptions<MediaSettings> settings)
        {
            _settings = settings.Value;
        }

        public string CreateSeriesFolder(string seriesName, int seasons, int seriesId)
        {
            var seriesPath = MediaStorageLayout.CreateDirectory(_settings.BasePath, MediaStorageLayout.SeriesFolder(seriesName, seriesId));

            for (int i = 1; i <= seasons; i++)
                MediaStorageLayout.CreateDirectory(_settings.BasePath,
                    MediaStorageLayout.RelativeFolder(_settings.BasePath, seriesPath) + $"/season {i}");

            return seriesPath;
        }

        public void UpdateSeriesFolders(string folderPath, int newSeasons)
        {
            if (!Directory.Exists(folderPath)) return;
            MediaFilePolicy.SafePath(_settings.BasePath, folderPath);

            var existing = Directory.GetDirectories(folderPath)
                .Select(Path.GetFileName)
                .Where(n => n != null && n.StartsWith("season "))
                .Select(n => int.TryParse(n!.Replace("season ", ""), out var num) ? num : 0)
                .Where(n => n > 0)
                .ToList();

            var maxExisting = existing.Any() ? existing.Max() : 0;

            for (int i = maxExisting + 1; i <= newSeasons; i++)
                MediaStorageLayout.CreateDirectory(_settings.BasePath,
                    MediaStorageLayout.RelativeFolder(_settings.BasePath, folderPath) + $"/season {i}");
        }

        public string CreateChannelEraFolder(int channelId, int eraId)
        {
            return MediaStorageLayout.CreateDirectory(_settings.BasePath, MediaStorageLayout.EraFolder(channelId, eraId));
        }
    }
}
