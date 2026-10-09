using ApplicationCore.Settings;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Infrastructure.BackgroundServices;

public sealed class MediaTranscodingService(IServiceScopeFactory scopes, IOptions<MediaProcessingSettings> settings,
    ILogger<MediaTranscodingService> logger) : MediaProcessingWorker(scopes, settings, logger)
{
    protected override string Worker => "transcode";
}
