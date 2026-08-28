using ApplicationCore.DTOs.Auth;
using ApplicationCore.Interfaces;
using Asp.Versioning;
using Azure;
using Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace WebApi.Controllers
{
    [AllowAnonymous] // Permite acceso sin autenticación
    [ApiController]
    [ApiVersion("1.0")] // Especifica la versión de la API para este controlador
    [Route("api/v{version:apiVersion}/auth")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;
        private readonly IUserService _userService;

        public AuthController(IAuthService authService, IUserService userService) => _authService = authService;

        private string IpAddress => HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";

        [HttpPost("token")]
        public async Task<IActionResult> Token(LoginRequest request)
        {
            await _authService.LoginAsync(request, Response, IpAddress);
            return Ok();
        }

        [HttpPost("refresh")]
        public async Task<IActionResult> Refresh()
        {
            await _authService.RefreshTokenAsync(Request, Response, IpAddress);
            return Ok();
        }

        [HttpPost("revoke")]
        [Authorize]
        public async Task<IActionResult> Revoke()
        {
            await _authService.RevokeTokenAsync(Request, Response, IpAddress);
            return NoContent();
        }
    }
}
