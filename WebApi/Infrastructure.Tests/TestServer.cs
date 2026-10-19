using System.Diagnostics;
using Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Infrastructure.Tests;

/// <summary>Runs only when NOSTALGIA_MEDIA_TEST_SQL points at a disposable SQL Server (CI service or local Express).</summary>
public sealed class SqlFactAttribute : FactAttribute
{
    public SqlFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("NOSTALGIA_MEDIA_TEST_SQL")))
            Skip = "Set NOSTALGIA_MEDIA_TEST_SQL to test against an isolated SQL Server database.";
    }
}

/// <summary>
/// A fresh database migrated with InitialCreate plus a temporary media library, wired with the same
/// Infrastructure registrations as the API. Everything is deleted on dispose.
/// </summary>
public sealed class TestServer : IAsyncDisposable
{
    public const string AdminPassword = "Test-Admin-Password-2026";
    private readonly ServiceProvider provider;

    private TestServer(ServiceProvider provider, string connection, DirectoryInfo media)
    {
        this.provider = provider;
        Connection = connection;
        Media = media;
    }

    public string Connection { get; }
    public DirectoryInfo Media { get; }
    public IServiceProvider Services => provider;

    public static async Task<TestServer> StartAsync()
    {
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("NOSTALGIA_MEDIA_TEST_SQL"))
        {
            InitialCatalog = "NostalgiaTV_Test_" + Guid.NewGuid().ToString("N")
        }.ConnectionString;
        var media = Directory.CreateTempSubdirectory("nostalgia-test-");
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:DefaultConnection"] = connection,
            ["Jwt:Key"] = "integration-test-signing-key-0123456789abcdef",
            ["Jwt:Issuer"] = "nostalgia-tests",
            ["Jwt:Audience"] = "nostalgia-tests",
            ["MediaSettings:BasePath"] = media.FullName,
            ["FFmpeg:BinaryFolder"] = FfmpegFolder ?? "",
            ["FileUpload:MaxFileSizeMB"] = "5",
            ["FileUpload:AllowedExtensions:0"] = ".png",
            ["SeriesUpload:MaxFileSizeMB"] = "200",
            ["MediaProcessing:StableAgeSeconds"] = "30",
            ["BootstrapAdminPassword"] = AdminPassword
        }).Build();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSignalR();
        services.AddSingleton<IConfiguration>(configuration);
        services.AddInfrastructure(configuration);
        var provider = services.BuildServiceProvider(new ServiceProviderOptions { ValidateScopes = true });
        var server = new TestServer(provider, connection, media);
        await using var scope = provider.CreateAsyncScope();
        await WebApi.DatabaseMigrationHost.MigrateAsync(scope.ServiceProvider, configuration);
        return server;
    }

    /// <summary>A new DI scope, like one HTTP request.</summary>
    public AsyncServiceScope Scope() => provider.CreateAsyncScope();

    public async Task<T> RunAsync<TService, T>(Func<TService, Task<T>> action) where TService : notnull
    {
        await using var scope = Scope();
        return await action(scope.ServiceProvider.GetRequiredService<TService>());
    }

    public async Task RunAsync<TService>(Func<TService, Task> action) where TService : notnull
    {
        await using var scope = Scope();
        await action(scope.ServiceProvider.GetRequiredService<TService>());
    }

    public async Task<T> DbAsync<T>(Func<NostalgiaTVContext, Task<T>> query) => await RunAsync(query);

    public async ValueTask DisposeAsync()
    {
        try
        {
            await using var context = new NostalgiaTVContext(new DbContextOptionsBuilder<NostalgiaTVContext>().UseSqlServer(Connection).Options);
            SqlConnection.ClearAllPools();
            await context.Database.EnsureDeletedAsync();
        }
        finally
        {
            await provider.DisposeAsync();
            try { Media.Delete(recursive: true); } catch (IOException) { }
        }
    }

    // ── ffmpeg fixtures ──

    public static string? FfmpegFolder => Environment.GetEnvironmentVariable("FFMPEG_BINARY_FOLDER")
        ?? (File.Exists(@"C:\ffmpeg\bin\ffmpeg.exe") ? @"C:\ffmpeg\bin" : null);

    public static bool HasFfmpeg => FfmpegFolder != null;

    /// <summary>Writes a tiny browser-compatible H.264/AAC MP4 of the given length.</summary>
    public static async Task WriteVideoAsync(string path, int seconds, bool compatible = true)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var ffmpeg = Path.Combine(FfmpegFolder ?? "", OperatingSystem.IsWindows() ? "ffmpeg.exe" : "ffmpeg");
        string[] codec = compatible
            ? ["-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "32k", "-movflags", "+faststart"]
            : ["-c:v", "mpeg4", "-c:a", "mp2"];
        var start = new ProcessStartInfo(ffmpeg) { RedirectStandardError = true, UseShellExecute = false, CreateNoWindow = true };
        foreach (var argument in (string[])["-y", "-v", "error", "-f", "lavfi", "-i", "color=c=blue:s=64x48:r=1", "-f", "lavfi", "-i",
                     "anullsrc=r=22050:cl=mono", "-t", seconds.ToString(), .. codec, "-shortest", path])
            start.ArgumentList.Add(argument);
        using var process = Process.Start(start)!;
        var error = await process.StandardError.ReadToEndAsync();
        await process.WaitForExitAsync();
        if (process.ExitCode != 0) throw new InvalidOperationException("ffmpeg failed: " + error);
    }
}
