using ApplicationCore.Interfaces;
using ApplicationCore.Settings;
using FFMpegCore;
using Infrastructure.BackgroundServices;
using Infrastructure.Contexts;
using Infrastructure.Mappings;
using Infrastructure.Services;
using Infrastructure.Services.InternalServices;
using Infrastructure.Services.Media;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Infrastructure
{
    public static class DependencyInjection
    {
        public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
        {
            MappingConfig.Configure();
            GlobalFFOptions.Configure(opts => opts.BinaryFolder = configuration["FFmpeg:BinaryFolder"]!);

            services.AddDbContext<NostalgiaTVContext>(options => options.UseSqlServer(configuration.GetConnectionString("DefaultConnection")));
            // SignalR is registered in Program.cs via AddSignalR() (which already includes the core services).

            //Configurations
            services.Configure<FileUploadSettings>(configuration.GetSection("FileUpload"));
            services.Configure<SeriesUploadSettings>(configuration.GetSection("SeriesUpload"));
            services.Configure<ChannelSchedulingSettings>(configuration.GetSection("ChannelScheduling"));
            services.AddMediaProcessing(configuration);

            //Services
            services.AddSingleton<ChannelBroadcastService>();

            services.AddScoped<ChannelScheduleService>();
            services.AddScoped<FileUploadService>();
            services.AddScoped<IAuthService, AuthService>();
            services.AddScoped<ISeriesService, SeriesService>();
            services.AddScoped<ICategoryService, CategoryService>();
            services.AddScoped<IEpisodeService, EpisodeService>();
            services.AddScoped<IChannelService, ChannelService>();
            services.AddScoped<IChannelEraService, ChannelEraService>();
            services.AddScoped<IChannelBumperService, ChannelBumperService>();
            services.AddScoped<IRolService, RolService>();
            services.AddScoped<IUserService, UserService>();
            services.AddScoped<IMenuService, MenuService>();
            services.AddScoped<SeriesFolderService>();

            //Background Services
            services.AddHostedService<ScheduleInitializerService>();
            services.AddHostedService<TokenCleanupService>();
            services.AddHostedService(sp => sp.GetRequiredService<ChannelBroadcastService>());

            return services;
        }

        public static IServiceCollection AddMediaProcessing(this IServiceCollection services, IConfiguration configuration)
        {
            services.Configure<MediaSettings>(configuration.GetSection("MediaSettings"));
            services.Configure<MediaProcessingSettings>(configuration.GetSection("MediaProcessing"));
            services.AddSingleton<MediaProcessRunner>();
            services.AddSingleton<MediaProbe>();
            services.AddSingleton<MediaTranscoder>();
            services.AddScoped<MediaLibraryService>();
            return services;
        }
    }
}
