using System.Diagnostics;
using System.Text;

namespace Infrastructure.Services.Media;

public sealed class MediaProcessRunner
{
    public async Task<string> RunAsync(string executable, IEnumerable<string> arguments, TimeSpan timeout,
        CancellationToken cancellationToken, Func<string, Task>? onLine = null)
    {
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        deadline.CancelAfter(timeout);
        using var process = new Process { StartInfo = new ProcessStartInfo(executable)
        {
            UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true
        } };
        foreach (var argument in arguments) process.StartInfo.ArgumentList.Add(argument);
        process.Start();
        using var registration = deadline.Token.Register(() =>
        {
            try { if (!process.HasExited) process.Kill(entireProcessTree: true); }
            catch (InvalidOperationException) { }
        });
        var output = new StringBuilder();
        var error = DrainErrorAsync(process.StandardError);
        try
        {
            while (await process.StandardOutput.ReadLineAsync(deadline.Token) is { } line)
            {
                if (onLine != null) await onLine(line);
                else
                {
                    if (output.Length + line.Length > 1024 * 1024) throw new IOException("Media probe response is too large.");
                    output.AppendLine(line);
                }
            }
            await process.WaitForExitAsync(deadline.Token);
            deadline.Token.ThrowIfCancellationRequested();
            var diagnostic = await error;
            if (process.ExitCode != 0) throw new IOException($"Media process failed ({process.ExitCode}): {diagnostic}");
            return output.ToString();
        }
        finally
        {
            if (!process.HasExited) process.Kill(entireProcessTree: true);
            await process.WaitForExitAsync(CancellationToken.None);
            await error;
        }
    }

    private static async Task<string> DrainErrorAsync(StreamReader reader)
    {
        var tail = new StringBuilder();
        var buffer = new char[2048];
        int count;
        while ((count = await reader.ReadAsync(buffer)) > 0)
        {
            tail.Append(buffer, 0, count);
            if (tail.Length > 8192) tail.Remove(0, tail.Length - 8192);
        }
        return tail.ToString();
    }
}
