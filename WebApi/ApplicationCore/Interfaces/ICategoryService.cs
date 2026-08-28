using ApplicationCore.DTOs.Category;
using System;
using System.Collections.Generic;
using System.Text;

namespace ApplicationCore.Interfaces
{
    public interface ICategoryService
    {
        Task<List<CategoryResponse>> GetAllAsync();
        Task<CategoryResponse> CreateAsync(CategoryRequest request);
        Task<CategoryResponse> UpdateAsync(int id, CategoryRequest request);
        Task DeleteAsync(int id);
    }
}
