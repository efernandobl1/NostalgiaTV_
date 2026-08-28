using ApplicationCore.DTOs.Channel;
using FluentValidation;

namespace WebApi.Validators
{
    public class ChannelRequestValidator : AbstractValidator<ChannelRequest>
    {
        public ChannelRequestValidator()
        {
            RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
            RuleFor(x => x.Logo)
                .Must(f => f == null || f.Length <= 5 * 1024 * 1024)
                .WithMessage("Logo must be less than 5MB.")
                .Must(f => f == null || new[] { "image/jpeg", "image/png", "image/svg+xml", "image/webp" }.Contains(f.ContentType))
                .WithMessage("Logo must be a valid image.");
            RuleFor(x => x.History).MaximumLength(1000);
            RuleFor(x => x.StartDate)
                .NotEmpty()
                .Must(d => d != DateTime.MinValue)
                .WithMessage("Start Date is required.");
            RuleFor(x => x.EndDate)
                .GreaterThan(x => x.StartDate)
                .When(x => x.EndDate.HasValue);
        }
    }
}
