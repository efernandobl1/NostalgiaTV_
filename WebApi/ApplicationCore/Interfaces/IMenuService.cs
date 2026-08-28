using ApplicationCore.DTOs.Menu;
using System;
using System.Collections.Generic;
using System.Text;

namespace ApplicationCore.Interfaces
{
    public interface IMenuService
    {
        Task<List<MenuResponse>> GetByUserAsync(int userId);
        Task<List<MenuResponse>> GetAllAsync();
    }
}
