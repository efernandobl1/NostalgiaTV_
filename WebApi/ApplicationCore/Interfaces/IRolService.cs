using ApplicationCore.DTOs.Rol;
using System;
using System.Collections.Generic;
using System.Text;

namespace ApplicationCore.Interfaces
{
    public interface IRolService
    {
        Task<List<RolResponse>> GetAllAsync();
        Task<RolResponse> CreateAsync(RolRequest request);
        Task<RolResponse> UpdateAsync(int id, RolRequest request);
        Task DeleteAsync(int id);
    }
}
