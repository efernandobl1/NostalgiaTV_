using WebApi.Handlers;

namespace WebApi.Extensions
{
    public static class ExceptionHandlerExtensions
    {
        public static IServiceCollection AddExceptionHandling(this IServiceCollection services)
        {
            services.AddExceptionHandler<GlobalExceptionHandler>();
            services.AddProblemDetails();
            return services;
        }
    }
}
