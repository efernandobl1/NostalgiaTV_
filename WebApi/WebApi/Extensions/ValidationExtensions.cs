using FluentValidation;
using FluentValidation.Results;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using SharpGrip.FluentValidation.AutoValidation.Mvc.Extensions;
using SharpGrip.FluentValidation.AutoValidation.Mvc.Results;
using System.ComponentModel.DataAnnotations;

namespace WebApi.Extensions
{
    public static class ValidationExtensions
    {
        public static IServiceCollection AddValidationConfig(this IServiceCollection services)
        {
            services.AddValidatorsFromAssemblyContaining<Program>();
            services.AddFluentValidationAutoValidation(config =>
            {
                config.OverrideDefaultResultFactoryWith<ValidationResultFactory>();
            });
            return services;
        }
    }

    file sealed class ValidationResultFactory : IFluentValidationAutoValidationResultFactory
    {
        public Task<IActionResult?> CreateActionResult(ActionExecutingContext context, ValidationProblemDetails validationProblemDetails, IDictionary<IValidationContext, FluentValidation.Results.ValidationResult> validationResults)
        {
            var errors = validationResults.Values
                .SelectMany(r => r.Errors)
                .GroupBy(e => e.PropertyName)
                .ToDictionary(
                    g => g.Key,
                    g => g.Select(e => e.ErrorMessage).ToArray()
                );

            var problem = new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Validation Failed",
                Detail = "One or more validation errors occurred.",
                Extensions = { ["errors"] = errors }
            };

            return Task.FromResult<IActionResult?>(new BadRequestObjectResult(problem));
        }
    }
}
