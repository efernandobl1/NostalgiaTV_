using ApplicationCore.Interfaces;
using ApplicationCore.Settings;
using FFMpegCore;
using Infrastructure.BackgroundServices;
using Infrastructure.Contexts;
using Infrastructure.Mappings;
using Infrastructure.Services;
using Infrastructure.Services.InternalServices;
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
            services.AddSignalRCore();

            //Configurations
            services.Configure<FileUploadSettings>(configuration.GetSection("FileUpload"));
            services.Configure<MediaSettings>(configuration.GetSection("MediaSettings"));

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
    }
}
