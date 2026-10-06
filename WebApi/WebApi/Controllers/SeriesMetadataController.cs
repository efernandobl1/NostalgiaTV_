using ApplicationCore.Entities;
using Asp.Versioning;
using Infrastructure.Contexts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace WebApi.Controllers;

[ApiController]
[Authorize(Policy = "Admin")]
[ApiVersion("1")]
[Route("api/v{version:apiVersion}/metadata")]
public class SeriesMetadataController : ControllerBase
{
    private readonly NostalgiaTVContext _context;

    public SeriesMetadataController(NostalgiaTVContext context) => _context = context;

    [HttpGet("providers")]
    public async Task<IActionResult> GetProviders() =>
        Ok(await _context.MetadataProviders.AsNoTracking().OrderBy(item => item.Code).ToListAsync());

    [HttpPost("providers")]
    public async Task<IActionResult> AddProvider(ProviderRequest request)
    {
        var code = request.Code?.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(code) || code.Length > 80
            || string.IsNullOrWhiteSpace(request.Name) || request.Name.Length > 200)
            return BadRequest("Invalid metadata provider.");
        if (await _context.MetadataProviders.AnyAsync(item => item.Code == code))
            return Conflict("This metadata provider already exists.");

        var provider = new MetadataProvider { Code = code, Name = request.Name.Trim() };
        _context.MetadataProviders.Add(provider);
        await _context.SaveChangesAsync();
        return Ok(provider);
    }

    [HttpGet("series/{seriesId}/external-ids")]
    public async Task<IActionResult> GetExternalIds(int seriesId) =>
        Ok(await _context.SeriesExternalIds.AsNoTracking()
            .Where(item => item.SeriesId == seriesId).ToListAsync());

    [HttpPut("series/{seriesId}/external-ids/{providerId}")]
    public async Task<IActionResult> SetExternalId(int seriesId, int providerId, ExternalIdRequest request)
    {
        var externalId = request.ExternalId?.Trim();
        if (string.IsNullOrWhiteSpace(externalId) || externalId.Length > 300)
            return BadRequest("Invalid external ID.");
        if (!await _context.Series.AnyAsync(item => item.Id == seriesId)
            || !await _context.MetadataProviders.AnyAsync(item => item.Id == providerId))
            return NotFound();
        var existing = await _context.SeriesExternalIds.FirstOrDefaultAsync(item =>
            item.ProviderId == providerId && item.ExternalId == externalId);
        if (existing != null && existing.SeriesId != seriesId)
            return Conflict("This provider ID belongs to another series.");
        if (existing == null)
        {
            existing = new SeriesExternalId
            {
                SeriesId = seriesId,
                ProviderId = providerId,
                ExternalId = externalId
            };
            _context.SeriesExternalIds.Add(existing);
            await _context.SaveChangesAsync();
        }
        return Ok(existing);
    }

    [HttpGet("series/{seriesId}/imports")]
    public async Task<IActionResult> GetImportHistory(int seriesId) =>
        Ok(await (
            from run in _context.MetadataImportRuns.AsNoTracking()
            join external in _context.SeriesExternalIds.AsNoTracking()
                on run.SeriesExternalId equals external.Id
            where external.SeriesId == seriesId
            orderby run.StartedAtUtc descending
            select run).Take(100).ToListAsync());
}

public sealed record ProviderRequest(string Code, string Name);
public sealed record ExternalIdRequest(string ExternalId);
