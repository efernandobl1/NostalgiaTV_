using ApplicationCore.Entities;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Contexts;

public static class ViewingModelConfiguration
{
    public static void ConfigureViewing(this ModelBuilder model)
    {
        model.Entity<MediaResourcePolicy>(policy =>
        {
            policy.Property(item => item.TimeZoneId).HasMaxLength(100);
            policy.HasData(new MediaResourcePolicy());
        });
        model.Entity<ViewerProfile>().HasKey(item => item.Id);
        model.Entity<ViewerProfile>().HasIndex(item => item.UserId).IsUnique();
        model.Entity<ViewerProfile>().HasOne<User>().WithMany().HasForeignKey(item => item.UserId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<DeviceAuthorization>(authorization =>
        {
            authorization.HasKey(item => item.DeviceCodeHash);
            authorization.Property(item => item.DeviceCodeHash).HasMaxLength(64);
            authorization.Property(item => item.UserCodeHash).HasMaxLength(64);
            authorization.Property(item => item.Name).HasMaxLength(80);
            authorization.HasIndex(item => item.UserCodeHash).IsUnique();
            authorization.HasIndex(item => item.ExpiresAtUtc);
            authorization.HasOne<ViewerProfile>().WithMany().HasForeignKey(item => item.ProfileId).OnDelete(DeleteBehavior.Cascade);
        });
        model.Entity<ViewerDevice>(device =>
        {
            device.Property(item => item.TokenHash).HasMaxLength(64);
            device.HasIndex(item => item.TokenHash).IsUnique();
            device.Property(item => item.Name).HasMaxLength(80);
            device.HasOne<ViewerProfile>().WithMany().HasForeignKey(item => item.ProfileId).OnDelete(DeleteBehavior.Cascade);
        });
        model.Entity<ViewerPairingCode>(code =>
        {
            code.HasKey(item => item.Hash);
            code.Property(item => item.Hash).HasMaxLength(64);
            code.HasIndex(item => item.DeviceId).IsUnique();
            code.HasOne<ViewerDevice>().WithMany().HasForeignKey(item => item.DeviceId).OnDelete(DeleteBehavior.Cascade);
        });
        model.Entity<ViewerProgress>(progress =>
        {
            progress.HasKey(item => new { item.ProfileId, item.EpisodeId });
            progress.HasOne<ViewerProfile>().WithMany().HasForeignKey(item => item.ProfileId).OnDelete(DeleteBehavior.Cascade);
            progress.HasOne<Episode>().WithMany().HasForeignKey(item => item.EpisodeId).OnDelete(DeleteBehavior.Cascade);
        });
        model.Entity<ViewerWatchRange>(range =>
        {
            range.HasIndex(item => new { item.ProfileId, item.EpisodeId, item.StartSecond });
            range.HasOne<ViewerProgress>().WithMany().HasForeignKey(item => new { item.ProfileId, item.EpisodeId }).OnDelete(DeleteBehavior.Cascade);
        });
        model.Entity<ChannelComment>(comment =>
        {
            comment.Property(item => item.Body).HasMaxLength(2000);
            comment.Property(item => item.Status).HasMaxLength(20);
            comment.HasIndex(item => new { item.ChannelId, item.Status, item.CreatedAtUtc });
            comment.HasOne<Channel>().WithMany().HasForeignKey(item => item.ChannelId).OnDelete(DeleteBehavior.Cascade);
            comment.HasOne<User>().WithMany().HasForeignKey(item => item.UserId).OnDelete(DeleteBehavior.Restrict);
        });
    }
}
