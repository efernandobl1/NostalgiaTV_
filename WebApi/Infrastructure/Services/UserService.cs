using ApplicationCore.DTOs.User;
using ApplicationCore.Entities;
using ApplicationCore.Exceptions;
using ApplicationCore.Interfaces;
using Infrastructure.Contexts;
using Mapster;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Text;

namespace Infrastructure.Services
{
    public class UserService : IUserService
    {
        private readonly NostalgiaTVContext _context;

        public UserService(NostalgiaTVContext context) => _context = context;

        public async Task<List<UserResponse>> GetAllAsync() =>
            await _context.Users
                .Include(u => u.Rol)
                .ThenInclude(r => r.Menus)
                .ProjectToType<UserResponse>()
                .ToListAsync();

        public async Task<UserResponse> CreateAsync(UserRequest request)
        {
            if (request.Password is null || request.Password.Length is < 12 or > 128)
                throw new BadRequestException("Password must contain between 12 and 128 characters.");
            if (await _context.Users.AnyAsync(u => u.Username == request.Username))
                throw new ConflictException("Username already exists.");

            var rol = await _context.Roles.FindAsync(request.RolId)
                ?? throw new NotFoundException($"Rol {request.RolId} not found");

            var user = new User
            {
                Username = request.Username,
                PasswordHash = AuthService.HashPassword(request.Password),
                RolId = request.RolId
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            user.Rol = rol;
            return user.Adapt<UserResponse>();
        }

        public async Task<UserResponse> UpdateAsync(int id, UserRequest request)
        {
            await using var transaction = await _context.Database.BeginTransactionAsync();
            await _context.Database.ExecuteSqlInterpolatedAsync($"DECLARE @result int; EXEC @result=sp_getapplock @Resource={"user-" + id}, @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=10000; IF @result < 0 THROW 50000, 'Authentication lock unavailable', 1;");
            var user = await _context.Users.Include(u => u.Rol).FirstOrDefaultAsync(u => u.Id == id) ?? throw new NotFoundException($"User {id} not found");

            if (await _context.Users.AnyAsync(u => u.Username == request.Username && u.Id != id))
                throw new ConflictException("Username already exists.");

            user.Username = request.Username;
            user.RolId = request.RolId;

            if (!string.IsNullOrEmpty(request.Password))
            {
                if (request.Password.Length is < 12 or > 128)
                    throw new BadRequestException("Password must contain between 12 and 128 characters.");
                if (AuthService.VerifyPassword(request.Password, user.PasswordHash))
                    throw new BadRequestException("New password must be different from the current one.");

                user.PasswordHash = AuthService.HashPassword(request.Password);
                user.SessionVersion++;
                user.FailedLoginAttempts = 0;
                user.LockedUntilUtc = null;
                await _context.RefreshTokens.Where(token => token.UserId == id && token.RevokedAt == null)
                    .ExecuteUpdateAsync(update => update.SetProperty(token => token.RevokedAt, DateTime.UtcNow));
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
            return user.Adapt<UserResponse>();
        }

        public async Task DeleteAsync(int id)
        {
            var user = await _context.Users.FindAsync(id)
                ?? throw new NotFoundException($"User {id} not found");
            _context.Users.Remove(user);
            await _context.SaveChangesAsync();
        }

        public async Task<UserResponse> GetByIdAsync(int id)
        {
            var user = await _context.Users
                .AsNoTracking()
                .Include(u => u.Rol)
                .ThenInclude(r => r.Menus)
                .FirstOrDefaultAsync(u => u.Id == id)
                ?? throw new NotFoundException($"User {id} not found");

            return user.Adapt<UserResponse>();
        }
    }
}
