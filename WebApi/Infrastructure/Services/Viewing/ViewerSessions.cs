using System.Security.Cryptography;
using System.Text;
using ApplicationCore.Entities;
using Infrastructure.Contexts;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services.Viewing;

public sealed class ViewerSessions(NostalgiaTVContext context, bool development)
{
    public string CookieName => development ? "viewer_device" : "__Host-viewer_device";
    public static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    public static string SafeName(string? value) => string.IsNullOrWhiteSpace(value) ? "Dispositivo" :
        new string(value.Where(character => !char.IsControl(character)).Take(80).ToArray());

    public Task<ViewerDevice?> DeviceAsync(HttpRequest request)
    {
        var hash = Hash(request.Cookies[CookieName] ?? "");
        return (from device in context.ViewerDevices
                join profile in context.ViewerProfiles on device.ProfileId equals profile.Id
                join user in context.Users on profile.UserId equals (int?)user.Id into users
                from user in users.DefaultIfEmpty()
                where device.TokenHash == hash && device.ExpiresAtUtc > DateTime.UtcNow &&
                    (profile.UserId == null || user != null && device.SessionVersion == user.SessionVersion)
                select device).SingleOrDefaultAsync();
    }

    public Task LockAsync(string resource) => context.Database.ExecuteSqlInterpolatedAsync($"DECLARE @result int; EXEC @result = sp_getapplock @Resource={resource}, @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=10000; IF @result < 0 THROW 50000, 'Viewer lock unavailable', 1;");

    // The caller owns a transaction; a unique index and account lock prevent duplicate profiles.
    public async Task<ViewerProfile> AccountProfileAsync(int userId, Guid? preferred = null)
    {
        await LockAsync("viewer-account-" + userId);
        var profile = await context.ViewerProfiles.SingleOrDefaultAsync(item => item.UserId == userId);
        if (profile != null) return profile;
        if (preferred != null)
        {
            await LockAsync("viewer-profile-" + preferred);
            profile = await context.ViewerProfiles.SingleOrDefaultAsync(item => item.Id == preferred && item.UserId == null);
        }
        if (profile == null)
        {
            profile = new ViewerProfile { Id = Guid.NewGuid(), CreatedAtUtc = DateTime.UtcNow };
            context.ViewerProfiles.Add(profile);
        }
        profile.UserId = userId;
        var version = await context.Users.Where(user => user.Id == userId).Select(user => user.SessionVersion).SingleAsync();
        await context.ViewerDevices.Where(device => device.ProfileId == profile.Id)
            .ExecuteUpdateAsync(update => update.SetProperty(device => device.SessionVersion, version));
        await context.SaveChangesAsync();
        return profile;
    }

    public async Task<ViewerDevice> CreateAsync(HttpResponse response, Guid profileId, string? name, int? version)
    {
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var now = DateTime.UtcNow;
        var device = new ViewerDevice { Id = Guid.NewGuid(), ProfileId = profileId, TokenHash = Hash(token),
            Name = SafeName(name), ExpiresAtUtc = now.AddMonths(6), LastSeenUtc = now, SessionVersion = version };
        context.ViewerDevices.Add(device);
        response.Cookies.Append(CookieName, token, new CookieOptions { HttpOnly = true, Secure = !development,
            SameSite = SameSiteMode.Strict, Path = development ? "/api/v1/viewer" : "/", Expires = device.ExpiresAtUtc, IsEssential = true });
        await context.SaveChangesAsync();
        return device;
    }
}
