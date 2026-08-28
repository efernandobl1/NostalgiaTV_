using ApplicationCore.DTOs.Auth;
using Microsoft.AspNetCore.Http;
using System;
using System.Collections.Generic;
using System.Text;

namespace ApplicationCore.Interfaces
{
    public interface IAuthService
    {
        Task LoginAsync(LoginRequest request, HttpResponse response, string ipAddress);
        Task RefreshTokenAsync(HttpRequest request, HttpResponse response, string ipAddress);
        Task RevokeTokenAsync(HttpRequest request, HttpResponse response, string ipAddress);
    }
}
