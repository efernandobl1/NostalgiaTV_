using Infrastructure.Services.Media;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Infrastructure.Tests;

public sealed class LinuxMediaFactAttribute : FactAttribute
{
    public LinuxMediaFactAttribute()
    {
        if (!OperatingSystem.IsLinux()) Skip = "CPU affinity requires a Linux runtime.";
    }
}

public class MediaCpuAffinityTests
{
    [LinuxMediaFact]
    public async Task ChildProcessesUseOneAllowedCpuByDefault()
    {
        using var services = new ServiceCollection().BuildServiceProvider();
        using var governor = new MediaCpuGovernor(services.GetRequiredService<IServiceScopeFactory>(), NullLogger<MediaCpuGovernor>.Instance);
        var runner = new MediaProcessRunner(governor);
        var output = await runner.RunAsync("/bin/sh", ["-c", "sleep 0.2; cat /proc/self/status"], TimeSpan.FromSeconds(10), CancellationToken.None);
        var cpus = output.Split('\n').Single(line => line.StartsWith("Cpus_allowed_list:", StringComparison.Ordinal)).Split(':')[1].Trim();
        Assert.True(int.TryParse(cpus, out _), "The child must be restricted to a single logical CPU.");
    }
}
