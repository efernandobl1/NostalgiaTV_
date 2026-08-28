using ApplicationCore.DTOs.User;
using FluentValidation;
using Infrastructure.Contexts;
using Microsoft.EntityFrameworkCore;

namespace WebApi.Validators
{
    public class UserRequestValidator : AbstractValidator<UserRequest>
    {
        private readonly NostalgiaTVContext _context;

        public UserRequestValidator(NostalgiaTVContext context)
        {
            _context = context;

            RuleFor(x => x.RolId)
                .GreaterThan(0)
                .MustAsync(RolExists)
                .WithMessage("Role not found.");

            RuleFor(x => x.Username)
                .NotEmpty()
                .MaximumLength(50);

            RuleFor(x => x.Password)
                .MinimumLength(8)
                .MaximumLength(50)
                .When(x => !string.IsNullOrEmpty(x.Password));
        }

        private async Task<bool> RolExists(int rolId, CancellationToken ct) => await _context.Roles.AnyAsync(r => r.Id == rolId, ct);
    }
}
