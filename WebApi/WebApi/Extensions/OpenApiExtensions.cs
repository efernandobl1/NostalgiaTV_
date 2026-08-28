using Microsoft.OpenApi;
using Scalar.AspNetCore;

namespace WebApi.Extensions;

public static class OpenApiExtensions
{
    public static IServiceCollection AddOpenApiConfig(this IServiceCollection services)
    {
        services.AddOpenApi("v1", options =>
        {
            options.AddDocumentTransformer((document, context, ct) =>
            {
                document.Info = new OpenApiInfo
                {
                    Title = "NostalgiaTV API v1",
                    Version = "1.0.0"
                };
                return Task.CompletedTask;
            });
        });

        return services;
    }

    public static WebApplication UseOpenApiConfig(this WebApplication app)
    {
        app.MapOpenApi();
        app.MapScalarApiReference(options =>
        {
            options
                .WithTitle("NostalgiaTV API")
                .WithTheme(ScalarTheme.Purple)
                .EnableDarkMode()
                .AddPreferredSecuritySchemes("Bearer")
                .WithDefaultHttpClient(ScalarTarget.JavaScript, ScalarClient.Fetch)
                .EnablePersistentAuthentication();
        });

        return app;
    }
}