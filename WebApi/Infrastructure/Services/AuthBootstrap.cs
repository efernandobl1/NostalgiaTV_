using Infrastructure.Contexts;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services;

public static class AuthBootstrap
{
    public const string RequiredPassword = "!bootstrap-required";

    public static async Task InitializeAsync(NostalgiaTVContext context, string? password)
    {
        var user = await context.Users.SingleOrDefaultAsync(user => user.Id == 1);
        if (user?.PasswordHash != RequiredPassword) return;
        if (password is null || password.Length is < 12 or > 128)
            throw new InvalidOperationException("Set BootstrapAdminPassword to a unique password of 12 to 128 characters before initializing the administrator.");
        user.PasswordHash = AuthService.HashPassword(password);
        user.SessionVersion++;
        await context.SaveChangesAsync();
    }
}
