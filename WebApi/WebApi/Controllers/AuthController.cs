using ApplicationCore.DTOs.Auth;
using ApplicationCore.Interfaces;
using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace WebApi.Controllers
{
    [ApiController]
    [ApiVersion("1.0")] // Especifica la versión de la API para este controlador
    [Route("api/v{version:apiVersion}/auth")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;

        public AuthController(IAuthService authService) => _authService = authService;

        private string IpAddress => HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";

        [HttpPost("token")]
        [AllowAnonymous]
        [EnableRateLimiting("AuthPolicy")]
        public async Task<IActionResult> Token(LoginRequest request)
        {
            await _authService.LoginAsync(request, Response, IpAddress);
            return Ok();
        }

        [HttpPost("refresh")]
        [AllowAnonymous]
        [EnableRateLimiting("AuthPolicy")]
        public async Task<IActionResult> Refresh()
        {
            await _authService.RefreshTokenAsync(Request, Response, IpAddress);
            return Ok();
        }

        [HttpPost("revoke")]
        [AllowAnonymous]
        [EnableRateLimiting("AuthPolicy")]
        public async Task<IActionResult> Revoke()
        {
            await _authService.RevokeTokenAsync(Request, Response, IpAddress);
            return NoContent();
        }
    }
}
