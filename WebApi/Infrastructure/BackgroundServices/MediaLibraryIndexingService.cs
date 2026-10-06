using ApplicationCore.Settings;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Infrastructure.BackgroundServices;

public sealed class MediaLibraryIndexingService(IServiceScopeFactory scopes, IOptions<MediaProcessingSettings> settings,
    ILogger<MediaLibraryIndexingService> logger) : MediaProcessingWorker(scopes, settings, logger)
{
    protected override string Worker => "index";
}
