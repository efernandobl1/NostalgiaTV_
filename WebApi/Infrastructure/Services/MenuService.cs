using ApplicationCore.DTOs.Menu;
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
    public class MenuService : IMenuService
    {
        private readonly NostalgiaTVContext _context;

        public MenuService(NostalgiaTVContext context) => _context = context;

        public async Task<List<MenuResponse>> GetByUserAsync(int userId)
        {
            var user = await _context.Users
                .Include(u => u.Rol)
                .ThenInclude(r => r.Menus)
                .FirstOrDefaultAsync(u => u.Id == userId)
                ?? throw new NotFoundException($"User {userId} not found");

            var allMenus = user.Rol.Menus
                .Where(m => m.IsVisible)
                .OrderBy(m => m.SortOrder)
                .Adapt<List<MenuResponse>>();

            var parents = allMenus.Where(m => m.ParentId == null).ToList();
            foreach (var parent in parents)
                parent.Children = allMenus.Where(m => m.ParentId == parent.Id).ToList();

            return parents;
        }

        public async Task<List<MenuResponse>> GetAllAsync()
        {
            var menus = await _context.Menus.ToListAsync();
            return menus.Adapt<List<MenuResponse>>();
        }

    }
}
