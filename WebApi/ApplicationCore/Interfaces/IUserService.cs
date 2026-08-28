using ApplicationCore.DTOs.User;
using System;
using System.Collections.Generic;
using System.Text;

namespace ApplicationCore.Interfaces
{
    public interface IUserService
    {
        Task<UserResponse> GetByIdAsync(int id);
        Task<List<UserResponse>> GetAllAsync();
        Task<UserResponse> CreateAsync(UserRequest request);
        Task<UserResponse> UpdateAsync(int id, UserRequest request);
        Task DeleteAsync(int id);
    }
}
