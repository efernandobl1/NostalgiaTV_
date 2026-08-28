using ApplicationCore.DTOs.Series;
using FluentValidation;

namespace WebApi.Validators
{
    public class SeriesRequestValidator : AbstractValidator<SeriesRequest>
    {
        public SeriesRequestValidator()
        {
            RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
            RuleFor(x => x.Description).MaximumLength(500);
            RuleFor(x => x.History).MaximumLength(1000);
            RuleFor(x => x.StartDate).NotEmpty();
            RuleFor(x => x.Rating).InclusiveBetween(0, 10).When(x => x.Rating.HasValue);
        }
    }
}
