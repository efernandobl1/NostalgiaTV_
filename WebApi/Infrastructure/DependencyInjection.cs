using ApplicationCore.Interfaces.Repositories;
using ApplicationCore.Interfaces.Services;
using ApplicationCore.Settings;
using Infrastructure.Broadcasting;
using Infrastructure.Hosting;
using Infrastructure.Media;
using Infrastructure.Persistence;
using Infrastructure.Repositories;
using Infrastructure.Security;
using Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Infrastructure;

public static class DependencyInjection
{
    /// <summary>Everything the API process needs: persistence, repositories, live broadcasting and external services.</summary>
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddPersistence(configuration);
        services.AddMediaProcessing(configuration);
        services.Configure<FileUploadSettings>(configuration.GetSection("FileUpload"));
        services.Configure<SeriesUploadSettings>(configuration.GetSection("SeriesUpload"));
        services.Configure<JwtSettings>(configuration.GetSection("Jwt"));
        services.AddSingleton<TokenIssuer>();
        services.AddMemoryCache();

        // Repositories hold the business rules and all Entity Framework access.
        services.AddScoped<IAuthRepository, AuthRepository>();
        services.AddScoped<IAccountRepository, AccountRepository>();
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IRoleRepository, RoleRepository>();
        services.AddScoped<IActivityRepository, ActivityRepository>();
        services.AddScoped<ISettingsRepository, SettingsRepository>();
        services.AddScoped<ICatalogRepository, CatalogRepository>();
        services.AddScoped<ISeriesRepository, SeriesRepository>();
        services.AddScoped<IMetadataRepository, MetadataRepository>();
        services.AddScoped<IInterludeRepository, InterludeRepository>();
        services.AddScoped<IChannelRepository, ChannelRepository>();
        services.AddScoped<IScheduleRepository, ScheduleRepository>();
        services.AddScoped<ICommentRepository, CommentRepository>();
        services.AddScoped<IViewerRepository, ViewerRepository>();
        services.AddScoped<IDashboardRepository, DashboardRepository>();

        // Services: only clients of external web services.
        services.Configure<TmdbSettings>(configuration.GetSection("Metadata:Tmdb"));
        services.AddHttpClient<IMetadataClient, TmdbMetadataClient>((provider, http) =>
        {
            http.BaseAddress = new Uri(provider.GetRequiredService<IOptions<TmdbSettings>>().Value.BaseUrl);
            http.Timeout = TimeSpan.FromSeconds(20);
        });

        services.AddSingleton<ScheduleSignals>();
        services.AddHostedService<ChannelBroadcaster>();
        services.AddHostedService<CredentialCleanupService>();
        return services;
    }

    public static IServiceCollection AddPersistence(this IServiceCollection services, IConfiguration configuration) =>
        // No retrying execution strategy: repositories open their own transactions (with sp_getapplock).
        services.AddDbContext<NostalgiaTVContext>(options => options.UseSqlServer(configuration.GetConnectionString("DefaultConnection")));

    /// <summary>Media library services shared by the API and the worker process.</summary>
    public static IServiceCollection AddMediaProcessing(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<MediaSettings>(configuration.GetSection("MediaSettings"));
        services.Configure<MediaProcessingSettings>(configuration.GetSection("MediaProcessing"));
        services.Configure<FileUploadSettings>(configuration.GetSection("FileUpload"));
        services.AddSingleton<MediaProcessRunner>();
        services.AddSingleton<MediaCpuGovernor>();
        services.AddSingleton<MediaProbe>();
        services.AddSingleton<MediaTranscoder>();
        services.AddSingleton<MediaStorageMeter>();
        services.AddSingleton<MediaLibrary>();
        services.AddScoped<LibraryImporter>();
        services.AddScoped<IMediaRepository, MediaRepository>();
        return services;
    }

    /// <summary>The separate media worker process: CPU governor plus the transcode and index loops.</summary>
    public static IServiceCollection AddMediaWorkers(this IServiceCollection services)
    {
        services.AddHostedService(provider => provider.GetRequiredService<MediaCpuGovernor>());
        services.AddHostedService<MediaTranscodingService>();
        services.AddHostedService<MediaIndexingService>();
        return services;
    }
}
