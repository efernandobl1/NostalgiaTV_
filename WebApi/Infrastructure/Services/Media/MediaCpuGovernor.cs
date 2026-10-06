using System.Collections.Concurrent;
using System.Diagnostics;
using System.Runtime.InteropServices;
using ApplicationCore.Entities;
using Infrastructure.Contexts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services.Media;

public sealed class MediaCpuGovernor(IServiceScopeFactory scopes, ILogger<MediaCpuGovernor> logger) : BackgroundService
{
    private readonly ConcurrentDictionary<int, Process> children = new();
    private readonly int[] allowed = ReadAllowedCpus();
    private int currentCores = 1;
    private bool ownsHost;
    public int EncodingThreads => Math.Min(4, Math.Max(1, allowed.Length));

    public void InitializeWorker()
    {
        ownsHost = true;
        ApplyHost(1);
    }

    public IDisposable Register(Process process)
    {
        children[process.Id] = process;
        try { Apply(process, currentCores); }
        catch { children.TryRemove(process.Id, out _); throw; }
        return new Lease(() => children.TryRemove(process.Id, out _));
    }

    protected override async Task ExecuteAsync(CancellationToken token)
    {
        while (!token.IsCancellationRequested)
        {
            try
            {
                using var scope = scopes.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<NostalgiaTVContext>();
                var policy = await context.MediaResourcePolicies.SingleAsync(item => item.Id == 1, token);
                var ceiling = Math.Min(4, Math.Min(allowed.Length, ReadQuota(allowed.Length)));
                currentCores = SelectCores(policy, DateTimeOffset.UtcNow, ceiling);
                if (ownsHost) ApplyHost(currentCores);
                foreach (var process in children.Values) Apply(process, currentCores);
                policy.AvailableCores = ceiling;
                policy.AppliedCores = currentCores;
                policy.AppliedAtUtc = DateTime.UtcNow;
                await context.SaveChangesAsync(token);
            }
            catch (OperationCanceledException) when (token.IsCancellationRequested) { break; }
            catch (Exception exception)
            {
                currentCores = 1;
                if (ownsHost) ApplyHost(1);
                foreach (var process in children.Values) Apply(process, 1);
                logger.LogError(exception, "Media CPU policy could not be applied; using one core");
            }
            await Task.Delay(TimeSpan.FromSeconds(5), token);
        }
    }

    public static int SelectCores(MediaResourcePolicy policy, DateTimeOffset utc, int ceiling)
    {
        var local = TimeZoneInfo.ConvertTime(utc, TimeZoneInfo.FindSystemTimeZoneById(policy.TimeZoneId));
        var minute = local.Hour * 60 + local.Minute;
        var night = policy.NightEnabled && (policy.NightStartMinute < policy.NightEndMinute
            ? minute >= policy.NightStartMinute && minute < policy.NightEndMinute
            : minute >= policy.NightStartMinute || minute < policy.NightEndMinute);
        return Math.Clamp(night ? policy.NightCores : Math.Min(2, policy.DayCores), 1, Math.Max(1, Math.Min(4, ceiling)));
    }

    private void ApplyHost(int cores)
    {
        using var process = Process.GetCurrentProcess();
        Apply(process, cores);
    }

    private void Apply(Process process, int cores)
    {
        if (!OperatingSystem.IsLinux()) return;
        try { ApplyThreads(process, cores); }
        catch (InvalidOperationException) { /* The registered child was disposed between polling and inspection. */ }
        catch (DirectoryNotFoundException) { /* A completed child no longer has a /proc task directory. */ }
    }

    private void ApplyThreads(Process process, int cores)
    {
        if (process.HasExited) return;
        var mask = new byte[128];
        foreach (var cpu in allowed.Take(cores)) mask[cpu / 8] |= (byte)(1 << (cpu % 8));
        // Linux affinity is per thread; include encoder and filter threads, not just the process leader.
        string[] threads;
        try { threads = Directory.GetDirectories($"/proc/{process.Id}/task"); }
        catch (DirectoryNotFoundException) when (process.HasExited) { return; }
        foreach (var directory in threads)
        {
            var tid = int.Parse(Path.GetFileName(directory));
            if (SetAffinity(tid, (nuint)mask.Length, mask) != 0 && Marshal.GetLastPInvokeError() != 3)
                throw new IOException("Cannot constrain media CPU affinity.");
        }
    }

    private static int[] ReadAllowedCpus()
    {
        if (!OperatingSystem.IsLinux()) return Enumerable.Range(0, Math.Max(1, Environment.ProcessorCount)).ToArray();
        var mask = new byte[128];
        if (GetAffinity(0, (nuint)mask.Length, mask) != 0) throw new IOException("Cannot inspect available media CPUs.");
        return Enumerable.Range(0, mask.Length * 8).Where(cpu => (mask[cpu / 8] & (1 << (cpu % 8))) != 0).ToArray();
    }

    private static int ReadQuota(int fallback)
    {
        if (OperatingSystem.IsLinux() && File.Exists("/sys/fs/cgroup/cpu.max"))
        {
            var values = File.ReadAllText("/sys/fs/cgroup/cpu.max").Trim().Split(' ');
            if (values[0] != "max" && double.TryParse(values[0], out var quota) && double.TryParse(values[1], out var period) && period > 0)
                return Math.Max(1, (int)Math.Floor(quota / period));
        }
        const string legacy = "/sys/fs/cgroup/cpu/";
        if (OperatingSystem.IsLinux() && File.Exists(legacy + "cpu.cfs_quota_us") && File.Exists(legacy + "cpu.cfs_period_us"))
        {
            var quota = double.Parse(File.ReadAllText(legacy + "cpu.cfs_quota_us"));
            var period = double.Parse(File.ReadAllText(legacy + "cpu.cfs_period_us"));
            if (quota > 0 && period > 0) return Math.Max(1, (int)Math.Floor(quota / period));
        }
        return Math.Max(1, fallback);
    }

    [DllImport("libc", EntryPoint = "sched_getaffinity", SetLastError = true)]
    private static extern int GetAffinity(int pid, nuint size, [Out] byte[] mask);
    [DllImport("libc", EntryPoint = "sched_setaffinity", SetLastError = true)]
    private static extern int SetAffinity(int pid, nuint size, byte[] mask);
    private sealed class Lease(Action release) : IDisposable { public void Dispose() => release(); }
}
