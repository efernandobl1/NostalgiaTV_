using ApplicationCore.Settings;
using Infrastructure;
using Infrastructure.BackgroundServices;
using Infrastructure.Contexts;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace WebApi;

public static class MediaWorkerHost
{
    public static async Task RunAsync(string[] args)
    {
        var builder = Host.CreateApplicationBuilder(args.Where(argument => argument != "--media-worker").ToArray());
        if (builder.Environment.IsDevelopment())
            builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true).AddEnvironmentVariables();
        builder.Services.AddSerilog(config => config.ReadFrom.Configuration(builder.Configuration));
        builder.Services.AddDbContext<NostalgiaTVContext>(options => options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));
        builder.Services.AddMediaProcessing(builder.Configuration);
        builder.Services.AddHostedService<MediaTranscodingService>();
        builder.Services.AddHostedService<MediaLibraryIndexingService>();
        var root = Path.GetFullPath(builder.Configuration["MediaSettings:BasePath"] ?? "wwwroot/uploads");
        Directory.CreateDirectory(root);
        var lockPath = Path.Combine(root, ".media-worker.lock");
        if (File.Exists(lockPath)) Infrastructure.Services.Media.MediaFilePolicy.SafePath(root, lockPath);
        // A shared-volume lock prevents two worker containers from processing the same library.
        using var lease = new FileStream(lockPath, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
        using var host = builder.Build();
        await host.RunAsync();
    }
}
