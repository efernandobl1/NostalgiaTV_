using Infrastructure.Services.Packages;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Asp.Versioning;

namespace WebApi.Controllers;

[ApiController, ApiVersion("1"), Authorize(Policy = "Admin")]
[Route("api/v{version:apiVersion}/channel-packages")]
[EnableRateLimiting("PackagePolicy")]
public sealed class ChannelPackagesController(ChannelPackageService packages, ILogger<ChannelPackagesController> logger) : ControllerBase
{
    // Bound concurrent disk work across all requests, not only per administrator.
    private static readonly SemaphoreSlim Gate = new(1, 1);

    [HttpPost("preview"), Consumes("multipart/form-data")]
    [RequestSizeLimit(525_336_576), RequestFormLimits(MultipartBodyLengthLimit = 525_336_576)]
    public Task<IActionResult> Preview([FromForm] IFormFile file, CancellationToken token) => Run(async () =>
    {
        ValidateUpload(file);
        await using var stream = file.OpenReadStream();
        return Ok(await packages.PreviewAsync(stream, token));
    }, token);

    [HttpPost("import"), Consumes("multipart/form-data")]
    [RequestSizeLimit(525_336_576), RequestFormLimits(MultipartBodyLengthLimit = 525_336_576)]
    public Task<IActionResult> Import([FromForm] IFormFile file, [FromForm] string fingerprint, CancellationToken token) => Run(async () =>
    {
        ValidateUpload(file);
        await using var stream = file.OpenReadStream();
        return Ok(await packages.ImportAsync(stream, fingerprint, token));
    }, token);

    [HttpPost("export/{channelId:int}")]
    public Task<IActionResult> Export(int channelId, ExportPackageRequest request, CancellationToken token) => Run(async () =>
    {
        ChannelPackageArchive.Require(request.RightsConfirmed || !request.IncludeMedia,
            "Confirma que puedes compartir los logos, bumpers y anuncios incluidos.");
        var path = await packages.ExportAsync(channelId, request.IncludeMedia, token, request.SharingPermission);
        var folder = Path.GetDirectoryName(path)!;
        Response.OnCompleted(() =>
        {
            try { if (Directory.Exists(folder)) Directory.Delete(folder, recursive: true); }
            catch (IOException error) { logger.LogWarning(error, "Package export cleanup failed"); }
            return Task.CompletedTask;
        });
        return File(new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read | FileShare.Delete,
            81920, FileOptions.Asynchronous | FileOptions.DeleteOnClose), "application/zip", "channel.ntv.zip");
    }, token);

    private static void ValidateUpload(IFormFile file) => ChannelPackageArchive.Require(file != null && file.Length is > 0 and <= ChannelPackageArchive.MaxBytes
        && file.FileName.EndsWith(".ntv.zip", StringComparison.OrdinalIgnoreCase), "Selecciona un paquete .ntv.zip de hasta 500 MiB.");

    private async Task<IActionResult> Run(Func<Task<IActionResult>> action, CancellationToken token)
    {
        if (!await Gate.WaitAsync(0, token)) return Conflict(new { message = "Otro paquete se está procesando. Inténtalo cuando termine." });
        try { return await action(); }
        catch (InvalidDataException error) { return BadRequest(new { message = error.Message }); }
        catch (KeyNotFoundException) { return NotFound(); }
        catch (ChannelPackageConflictException error) { return Conflict(new { message = error.Message }); }
        catch (DbUpdateException error)
        {
            logger.LogWarning(error, "Channel package import conflicted with existing data");
            return Conflict(new { message = "El paquete entra en conflicto con datos existentes. Revisa sus series o si ya fue instalado." });
        }
        catch (IOException error)
        {
            logger.LogWarning(error, "Channel package media could not be validated");
            return BadRequest(new { message = "No se pudo leer o validar el paquete. Revisa los archivos, permisos y espacio disponible." });
        }
        finally { Gate.Release(); }
    }
}

public sealed record ExportPackageRequest(bool IncludeMedia, bool RightsConfirmed, string? SharingPermission = null);
