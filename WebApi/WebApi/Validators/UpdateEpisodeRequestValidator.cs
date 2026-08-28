using ApplicationCore.DTOs.Episode;
using FluentValidation;

namespace WebApi.Validators
{
    public class UpdateEpisodeRequestValidator : AbstractValidator<UpdateEpisodeRequest>
    {
        public UpdateEpisodeRequestValidator()
        {
            RuleFor(x => x.Title).MaximumLength(200);
            RuleFor(x => x.EpisodeNumber).GreaterThanOrEqualTo(0);
            RuleFor(x => x.EpisodeTypeId).GreaterThanOrEqualTo(0);
        }
    }
}
