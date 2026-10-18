using ApplicationCore.Entities;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Persistence.Configurations;

/// <summary>Reference rows every installation starts with.</summary>
internal static class SeedData
{
    /// <summary>Placeholder hash; the migration host replaces it with BootstrapAdminPassword.</summary>
    public const string BootstrapPasswordHash = "!bootstrap-required";

    /// <summary>Admin sidebar of the v2 design: groups and their screens.</summary>
    public static readonly Menu[] Menus =
    [
        new() { Id = 1, Name = "Operation", Caption = "OPERACIÓN", Icon = "radio", Url = "", SortOrder = 1, IsVisible = true },
        new() { Id = 2, Name = "Catalog", Caption = "CATÁLOGO", Icon = "library", Url = "", SortOrder = 2, IsVisible = true },
        new() { Id = 3, Name = "Audience", Caption = "AUDIENCIA", Icon = "users", Url = "", SortOrder = 3, IsVisible = true },
        new() { Id = 4, Name = "System", Caption = "SISTEMA", Icon = "settings", Url = "", SortOrder = 4, IsVisible = true },
        new() { Id = 5, ParentId = 1, Name = "Summary", Caption = "Resumen", Icon = "gauge", Url = AdminMenuUrls.Summary, SortOrder = 1, IsVisible = true },
        new() { Id = 6, ParentId = 1, Name = "Schedule", Caption = "Programación", Icon = "calendar", Url = AdminMenuUrls.Schedule, SortOrder = 2, IsVisible = true },
        new() { Id = 7, ParentId = 1, Name = "Channels", Caption = "Canales y eras", Icon = "tv", Url = AdminMenuUrls.Channels, SortOrder = 3, IsVisible = true },
        new() { Id = 8, ParentId = 2, Name = "Series", Caption = "Series y episodios", Icon = "film", Url = AdminMenuUrls.Series, SortOrder = 1, IsVisible = true },
        new() { Id = 9, ParentId = 2, Name = "Interludes", Caption = "Interludios", Icon = "clapperboard", Url = AdminMenuUrls.Interludes, SortOrder = 2, IsVisible = true },
        new() { Id = 10, ParentId = 3, Name = "Viewers", Caption = "Espectadores", Icon = "eye", Url = AdminMenuUrls.Viewers, SortOrder = 1, IsVisible = true },
        new() { Id = 11, ParentId = 3, Name = "Comments", Caption = "Comentarios", Icon = "message", Url = AdminMenuUrls.Comments, SortOrder = 2, IsVisible = true },
        new() { Id = 12, ParentId = 4, Name = "Media", Caption = "Procesamiento", Icon = "cpu", Url = AdminMenuUrls.Media, SortOrder = 1, IsVisible = true },
        new() { Id = 13, ParentId = 4, Name = "Access", Caption = "Acceso", Icon = "shield", Url = AdminMenuUrls.Access, SortOrder = 2, IsVisible = true },
        new() { Id = 14, ParentId = 4, Name = "Settings", Caption = "Ajustes", Icon = "sliders", Url = AdminMenuUrls.Settings, SortOrder = 3, IsVisible = true },
    ];

    /// <summary>Editor: operation, catalog and comment moderation (as in the design's access screen).</summary>
    private static readonly int[] EditorMenus = [1, 5, 6, 7, 2, 8, 9, 3, 11];

    public static void SeedReferenceData(this ModelBuilder model)
    {
        model.Entity<Role>().HasData(
            new Role { Id = SeedIds.AdministratorRole, Name = "Administrador", Description = "Acceso completo al panel" },
            new Role { Id = SeedIds.ViewerRole, Name = "Espectador", Description = "Rol asignado al registrarse" },
            new Role { Id = SeedIds.EditorRole, Name = "Editor", Description = "Catálogo, canales y programación" });

        model.Entity<Menu>().HasData(Menus);
        model.Entity<RoleMenu>().HasData(
            Menus.Select(menu => new RoleMenu { RoleId = SeedIds.AdministratorRole, MenuId = menu.Id })
                .Concat(EditorMenus.Select(menu => new RoleMenu { RoleId = SeedIds.EditorRole, MenuId = menu })));

        model.Entity<User>().HasData(new User
        {
            Id = SeedIds.BootstrapAdmin,
            RoleId = SeedIds.AdministratorRole,
            Username = "admin",
            PasswordHash = BootstrapPasswordHash
        });

        model.Entity<EpisodeType>().HasData(
            new EpisodeType { Id = SeedIds.RegularEpisode, Name = "Episodio" },
            new EpisodeType { Id = SeedIds.Special, Name = "Especial" },
            new EpisodeType { Id = SeedIds.ChristmasSpecial, Name = "Especial de Navidad" },
            new EpisodeType { Id = SeedIds.HalloweenSpecial, Name = "Especial de Halloween" },
            new EpisodeType { Id = SeedIds.Movie, Name = "Película" });

        model.Entity<MetadataProvider>().HasData(
            new MetadataProvider { Id = 1, Code = "tmdb", Name = "TMDB" },
            new MetadataProvider { Id = 2, Code = "tvdb", Name = "TheTVDB" });

        model.Entity<MediaWorkerState>().HasData(
            new MediaWorkerState { Id = MediaWorkers.Transcode },
            new MediaWorkerState { Id = MediaWorkers.Index });

        model.Entity<MediaResourcePolicy>().HasData(new MediaResourcePolicy());
        model.Entity<PlatformSettings>().HasData(new PlatformSettings { ViewerRoleId = SeedIds.ViewerRole });
    }
}
