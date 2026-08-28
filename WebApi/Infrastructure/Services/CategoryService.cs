using ApplicationCore.DTOs.Category;
using ApplicationCore.Entities;
using ApplicationCore.Exceptions;
using ApplicationCore.Interfaces;
using Infrastructure.Contexts;
using Mapster;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services
{
    public class CategoryService : ICategoryService
    {
        private readonly NostalgiaTVContext _context;

        public CategoryService(NostalgiaTVContext context)
        {
            _context = context;
        }

        public async Task<List<CategoryResponse>> GetAllAsync() =>
            await _context.Categories.ProjectToType<CategoryResponse>().ToListAsync();

        public async Task<CategoryResponse> CreateAsync(CategoryRequest request)
        {
            var category = request.Adapt<Category>();
            _context.Categories.Add(category);
            await _context.SaveChangesAsync();
            return category.Adapt<CategoryResponse>();
        }

        public async Task<CategoryResponse> UpdateAsync(int id, CategoryRequest request)
        {
            var category = await _context.Categories.FindAsync(id)
                ?? throw new NotFoundException($"Category {id} not found");

            category.Name = request.Name;
            await _context.SaveChangesAsync();
            return category.Adapt<CategoryResponse>();
        }

        public async Task DeleteAsync(int id)
        {
            var category = await _context.Categories.FindAsync(id)
                ?? throw new NotFoundException($"Category {id} not found");

            _context.Categories.Remove(category);
            await _context.SaveChangesAsync();
        }
    }
}
