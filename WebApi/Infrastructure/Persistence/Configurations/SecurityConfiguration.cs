using ApplicationCore.Entities;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Persistence.Configurations;

internal static class SecurityConfiguration
{
    public const string ActiveRows = "[DeletedAtUtc] IS NULL";

    public static void ConfigureSecurity(this ModelBuilder model)
    {
        model.Entity<Role>(role =>
        {
            role.Property(item => item.Name).HasMaxLength(100);
            role.HasIndex(item => item.Name).IsUnique().HasFilter(ActiveRows);
        });

        model.Entity<Menu>(menu =>
        {
            menu.Property(item => item.Name).HasMaxLength(100);
            menu.Property(item => item.Caption).HasMaxLength(200);
            menu.Property(item => item.Icon).HasMaxLength(100);
            menu.Property(item => item.Url).HasMaxLength(400);
            menu.HasIndex(item => item.Name).IsUnique().HasFilter(ActiveRows);
            menu.HasIndex(item => new { item.ParentId, item.SortOrder });
            menu.HasOne(item => item.Parent).WithMany().HasForeignKey(item => item.ParentId).OnDelete(DeleteBehavior.NoAction);
        });

        model.Entity<RoleMenu>(link =>
        {
            link.HasKey(item => new { item.RoleId, item.MenuId });
            link.HasIndex(item => item.MenuId);
            link.HasOne(item => item.Role).WithMany(role => role.Menus).HasForeignKey(item => item.RoleId).OnDelete(DeleteBehavior.Restrict);
            link.HasOne(item => item.Menu).WithMany().HasForeignKey(item => item.MenuId).OnDelete(DeleteBehavior.Restrict);
        });

        model.Entity<User>(user =>
        {
            user.Property(item => item.Username).HasMaxLength(100);
            user.HasIndex(item => item.Username).IsUnique().HasFilter(ActiveRows);
            user.HasIndex(item => item.RoleId);
            user.HasOne(item => item.Role).WithMany().HasForeignKey(item => item.RoleId).OnDelete(DeleteBehavior.Restrict);
        });

        model.Entity<UserExternalLogin>(login =>
        {
            login.HasKey(item => new { item.Provider, item.Subject });
            login.Property(item => item.Provider).HasMaxLength(40);
            login.Property(item => item.Subject).HasMaxLength(255);
            login.HasIndex(item => new { item.UserId, item.Provider }).IsUnique();
            login.HasOne(item => item.User).WithMany(user => user.ExternalLogins).HasForeignKey(item => item.UserId).OnDelete(DeleteBehavior.Restrict);
        });

        model.Entity<RefreshToken>(token =>
        {
            token.Property(item => item.Token).HasMaxLength(64);
            token.Property(item => item.IpAddress).HasMaxLength(45);
            token.HasIndex(item => item.Token).IsUnique();
            token.HasIndex(item => new { item.UserId, item.RevokedAt });
            token.HasIndex(item => item.ExpiresAt);
            token.HasOne(item => item.User).WithMany().HasForeignKey(item => item.UserId).OnDelete(DeleteBehavior.Restrict);
            token.HasOne<RefreshToken>().WithMany().HasForeignKey(item => item.ReplacedByTokenId).OnDelete(DeleteBehavior.NoAction);
        });

        model.Entity<ActivityLog>(log =>
        {
            log.Property(item => item.Action).HasMaxLength(100);
            log.Property(item => item.Resource).HasMaxLength(400);
            log.HasIndex(item => item.CreatedAtUtc);
            log.HasIndex(item => new { item.UserId, item.CreatedAtUtc });
            log.HasOne(item => item.User).WithMany().HasForeignKey(item => item.UserId).OnDelete(DeleteBehavior.SetNull);
        });
    }
}
