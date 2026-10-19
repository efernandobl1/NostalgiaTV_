using Infrastructure;
using Infrastructure.Media;
using Infrastructure.Persistence;
using Serilog;

namespace WebApi;

/// <summary>The separate media worker process (transcode and index loops on the shared library volume).</summary>
public static class MediaWorkerHost
{
    public static async Task RunAsync(string[] args)
    {
        var builder = Host.CreateApplicationBuilder(args.Where(argument => argument != "--media-worker").ToArray());
        if (builder.Environment.IsDevelopment())
            builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true).AddEnvironmentVariables();
        else
            await DatabaseConnectionPolicy.ValidateAsync(builder.Configuration.GetConnectionString("DefaultConnection"));
        builder.Services.AddSerilog(config => config.ReadFrom.Configuration(builder.Configuration));
        builder.Services.AddPersistence(builder.Configuration);
        builder.Services.AddMediaProcessing(builder.Configuration);
        builder.Services.AddMediaWorkers();

        var root = Path.GetFullPath(builder.Configuration["MediaSettings:BasePath"] ?? "wwwroot/uploads");
        Directory.CreateDirectory(root);
        var lockPath = Path.Combine(root, ".media-worker.lock");
        if (File.Exists(lockPath)) MediaFilePolicy.SafePath(root, lockPath);
        // A shared-volume lock prevents two worker containers from processing the same library.
        using var lease = new FileStream(lockPath, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
        using var host = builder.Build();
        host.Services.GetRequiredService<MediaCpuGovernor>().InitializeWorker();
        await host.RunAsync();
    }
}
