using ApplicationCore.DTOs.Rol;
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
    public class RolService : IRolService
    {
        private readonly NostalgiaTVContext _context;

        public RolService(NostalgiaTVContext context) => _context = context;

        public async Task<List<RolResponse>> GetAllAsync() =>
            await _context.Roles
                .Include(r => r.Menus)
                .ProjectToType<RolResponse>()
                .ToListAsync();

        public async Task<RolResponse> CreateAsync(RolRequest request)
        {
            var selectedMenus = await _context.Menus
                .Where(m => request.MenuIds.Contains(m.Id))
                .ToListAsync();

            var parentIds = selectedMenus
                .Where(m => m.ParentId.HasValue)
                .Select(m => m.ParentId!.Value)
                .Distinct()
                .ToList();

            var parentMenus = await _context.Menus
                .Where(m => parentIds.Contains(m.Id))
                .ToListAsync();

            var rol = new Rol
            {
                Name = request.Name,
                Description = request.Description,
                Menus = selectedMenus.Union(parentMenus).ToList()
            };

            _context.Roles.Add(rol);
            await _context.SaveChangesAsync();
            return rol.Adapt<RolResponse>();
        }

        public async Task<RolResponse> UpdateAsync(int id, RolRequest request)
        {
            var rol = await _context.Roles.Include(r => r.Menus).FirstOrDefaultAsync(r => r.Id == id)
                ?? throw new NotFoundException($"Rol {id} not found");

            rol.Name = request.Name;
            rol.Description = request.Description;

            // Get selected menus and their parents
            var selectedMenus = await _context.Menus
                .Where(m => request.MenuIds.Contains(m.Id))
                .ToListAsync();

            var parentIds = selectedMenus
                .Where(m => m.ParentId.HasValue)
                .Select(m => m.ParentId!.Value)
                .Distinct()
                .ToList();

            var parentMenus = await _context.Menus
                .Where(m => parentIds.Contains(m.Id))
                .ToListAsync();

            rol.Menus = selectedMenus.Union(parentMenus).ToList();

            await _context.SaveChangesAsync();
            return rol.Adapt<RolResponse>();
        }

        public async Task DeleteAsync(int id)
        {
            var rol = await _context.Roles.FindAsync(id)
                ?? throw new NotFoundException($"Rol {id} not found");
            _context.Roles.Remove(rol);
            await _context.SaveChangesAsync();
        }
    }
}
