using ApplicationCore.DTOs;
using ApplicationCore.Entities;
using ApplicationCore.Exceptions;
using ApplicationCore.Interfaces.Repositories;
using ApplicationCore.Policies;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories;

public sealed class SettingsRepository(NostalgiaTVContext context) : ISettingsRepository
{
    public async Task<PlatformSettingsResponse> GetAsync() => Map(await context.PlatformSettings.AsNoTracking().SingleAsync());

    public async Task<PlatformSettingsResponse> UpdateAsync(PlatformSettingsRequest request)
    {
        if (request.ViewerRoleId == SeedIds.AdministratorRole) throw new BadRequestException("El rol de espectador no puede ser el de administrador.");
        if (!await context.Roles.AnyAsync(role => role.Id == request.ViewerRoleId)) throw new BadRequestException("El rol de espectador no existe.");
        if (await context.RoleMenus.AnyAsync(link => link.RoleId == request.ViewerRoleId))
            throw new BadRequestException("El rol de espectador no puede tener permisos del panel.");
        var settings = await context.PlatformSettings.SingleAsync();
        settings.TimeZoneId = request.TimeZoneId;
        settings.ViewerRoleId = request.ViewerRoleId;
        settings.PublicRegistrationEnabled = request.PublicRegistrationEnabled;
        settings.NoRepeatWindowHours = request.NoRepeatWindowHours;
        settings.MaxSpecialsPerDay = request.MaxSpecialsPerDay;
        settings.MaxSpecialsPerSeriesPerDay = request.MaxSpecialsPerSeriesPerDay;
        settings.MaxMoviesPerDay = request.MaxMoviesPerDay;
        settings.MaxMoviesPerSeriesPerDay = request.MaxMoviesPerSeriesPerDay;
        settings.SeasonalEffectsEnabled = request.SeasonalEffectsEnabled;
        settings.SeasonalEpisodesEnabled = request.SeasonalEpisodesEnabled;
        settings.SeasonalInterludesEnabled = request.SeasonalInterludesEnabled;
        settings.SeasonalThemesEnabled = request.SeasonalThemesEnabled;
        await context.SaveChangesAsync();
        return Map(settings);
    }

    public async Task<PublicSettingsResponse> GetPublicAsync()
    {
        var settings = await context.PlatformSettings.AsNoTracking().SingleAsync();
        var season = settings.SeasonalThemesEnabled ? SeasonalProgrammingPolicy.SeasonAt(DateTime.UtcNow, settings.TimeZoneId) : InterludeSeason.AllYear;
        return new PublicSettingsResponse(settings.TimeZoneId, season, settings.SeasonalThemesEnabled, settings.SeasonalEffectsEnabled,
            settings.PublicRegistrationEnabled);
    }

    private static PlatformSettingsResponse Map(PlatformSettings item) => new(item.TimeZoneId, item.ViewerRoleId, item.PublicRegistrationEnabled,
        item.NoRepeatWindowHours, item.MaxSpecialsPerDay, item.MaxSpecialsPerSeriesPerDay, item.MaxMoviesPerDay, item.MaxMoviesPerSeriesPerDay,
        item.SeasonalEffectsEnabled, item.SeasonalEpisodesEnabled, item.SeasonalInterludesEnabled, item.SeasonalThemesEnabled);
}

public sealed class CatalogRepository(NostalgiaTVContext context) : ICatalogRepository
{
    // ── Categories ──

    public async Task<IReadOnlyList<CatalogItem>> ListCategoriesAsync() =>
        await context.Categories.AsNoTracking().OrderBy(category => category.Name)
            .Select(category => new CatalogItem(category.Id, category.Name,
                context.SeriesCategories.Count(link => link.CategoryId == category.Id && link.Series.DeletedAtUtc == null)))
            .ToListAsync();

    public async Task<CatalogItem> CreateCategoryAsync(CatalogItemRequest request)
    {
        var name = request.Name.Trim();
        if (await context.Categories.AnyAsync(category => category.Name == name)) throw new ConflictException("Esa categoría ya existe.");
        var category = new Category { Name = name };
        context.Categories.Add(category);
        await context.SaveChangesAsync();
        return new CatalogItem(category.Id, category.Name, 0);
    }

    public async Task<CatalogItem> RenameCategoryAsync(int id, CatalogItemRequest request)
    {
        var category = await context.Categories.SingleOrDefaultAsync(item => item.Id == id) ?? throw new NotFoundException("Categoría no encontrada.");
        var name = request.Name.Trim();
        if (await context.Categories.AnyAsync(item => item.Name == name && item.Id != id)) throw new ConflictException("Esa categoría ya existe.");
        category.Name = name;
        await context.SaveChangesAsync();
        return (await ListCategoriesAsync()).Single(item => item.Id == id);
    }

    public async Task DeleteCategoryAsync(int id)
    {
        var category = await context.Categories.SingleOrDefaultAsync(item => item.Id == id) ?? throw new NotFoundException("Categoría no encontrada.");
        await using var transaction = await context.Database.BeginTransactionAsync();
        await context.SeriesCategories.Where(link => link.CategoryId == id).ExecuteDeleteAsync();
        category.DeletedAtUtc = DateTime.UtcNow;
        await context.SaveChangesAsync();
        await transaction.CommitAsync();
    }

    public async Task<IReadOnlyList<CategoryFacet>> PublicCategoriesAsync() =>
        await context.Categories.AsNoTracking().OrderBy(category => category.Name)
            .Select(category => new CategoryFacet(category.Id, category.Name,
                context.SeriesCategories.Count(link => link.CategoryId == category.Id && link.Series.DeletedAtUtc == null)))
            .ToListAsync();

    // ── Episode types ──

    public async Task<IReadOnlyList<CatalogItem>> ListEpisodeTypesAsync() =>
        await context.EpisodeTypes.AsNoTracking().OrderBy(type => type.Id)
            .Select(type => new CatalogItem(type.Id, type.Name, context.Episodes.Count(episode => episode.EpisodeTypeId == type.Id)))
            .ToListAsync();

    public async Task<CatalogItem> CreateEpisodeTypeAsync(CatalogItemRequest request)
    {
        var name = request.Name.Trim();
        if (name.Length > 50) throw new BadRequestException("El nombre admite hasta 50 caracteres.");
        if (await context.EpisodeTypes.AnyAsync(type => type.Name == name)) throw new ConflictException("Ese tipo de episodio ya existe.");
        var type = new EpisodeType { Name = name };
        context.EpisodeTypes.Add(type);
        await context.SaveChangesAsync();
        return new CatalogItem(type.Id, type.Name, 0);
    }

    public async Task<CatalogItem> RenameEpisodeTypeAsync(int id, CatalogItemRequest request)
    {
        var type = await context.EpisodeTypes.SingleOrDefaultAsync(item => item.Id == id) ?? throw new NotFoundException("Tipo de episodio no encontrado.");
        var name = request.Name.Trim();
        if (name.Length > 50) throw new BadRequestException("El nombre admite hasta 50 caracteres.");
        if (await context.EpisodeTypes.AnyAsync(item => item.Name == name && item.Id != id)) throw new ConflictException("Ese tipo de episodio ya existe.");
        type.Name = name;
        await context.SaveChangesAsync();
        return (await ListEpisodeTypesAsync()).Single(item => item.Id == id);
    }

    public async Task DeleteEpisodeTypeAsync(int id)
    {
        // Seeded types drive seasonal programming and daily caps.
        if (id <= SeedIds.Movie) throw new BadRequestException("Los tipos base del sistema no se pueden eliminar.");
        var type = await context.EpisodeTypes.SingleOrDefaultAsync(item => item.Id == id) ?? throw new NotFoundException("Tipo de episodio no encontrado.");
        if (await context.Episodes.AnyAsync(episode => episode.EpisodeTypeId == id)) throw new ConflictException("Hay episodios con este tipo; cámbialos antes de eliminarlo.");
        type.DeletedAtUtc = DateTime.UtcNow;
        await context.SaveChangesAsync();
    }

    // ── Metadata providers ──

    public async Task<IReadOnlyList<MetadataProviderItem>> ListProvidersAsync() =>
        await context.MetadataProviders.AsNoTracking().OrderBy(provider => provider.Code)
            .Select(provider => new MetadataProviderItem(provider.Id, provider.Code, provider.Name,
                context.SeriesExternalIds.Count(external => external.ProviderId == provider.Id)))
            .ToListAsync();

    public async Task<MetadataProviderItem> CreateProviderAsync(MetadataProviderRequest request)
    {
        var code = request.Code.Trim().ToLowerInvariant();
        if (await context.MetadataProviders.AnyAsync(provider => provider.Code == code)) throw new ConflictException("Ese proveedor ya existe.");
        var provider = new MetadataProvider { Code = code, Name = request.Name.Trim() };
        context.MetadataProviders.Add(provider);
        await context.SaveChangesAsync();
        return new MetadataProviderItem(provider.Id, provider.Code, provider.Name, 0);
    }

    public async Task<MetadataProviderItem> UpdateProviderAsync(int id, MetadataProviderRequest request)
    {
        var provider = await context.MetadataProviders.SingleOrDefaultAsync(item => item.Id == id) ?? throw new NotFoundException("Proveedor no encontrado.");
        var code = request.Code.Trim().ToLowerInvariant();
        if (await context.MetadataProviders.AnyAsync(item => item.Code == code && item.Id != id)) throw new ConflictException("Ese proveedor ya existe.");
        provider.Code = code;
        provider.Name = request.Name.Trim();
        await context.SaveChangesAsync();
        return (await ListProvidersAsync()).Single(item => item.Id == id);
    }

    public async Task DeleteProviderAsync(int id)
    {
        var provider = await context.MetadataProviders.SingleOrDefaultAsync(item => item.Id == id) ?? throw new NotFoundException("Proveedor no encontrado.");
        if (await context.SeriesExternalIds.AnyAsync(external => external.ProviderId == id))
            throw new ConflictException("Hay series vinculadas a este proveedor; quita sus identificadores primero.");
        provider.DeletedAtUtc = DateTime.UtcNow;
        await context.SaveChangesAsync();
    }
}
