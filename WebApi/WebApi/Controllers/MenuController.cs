using ApplicationCore.Interfaces;
using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace WebApi.Controllers
{
    [ApiController]
    [Authorize]
    [ApiVersion("1")]
    [Route("api/v{version:apiVersion}/menus")]
    public class MenuController : ControllerBase
    {
        private readonly IMenuService _menuService;

        public MenuController(IMenuService menuService) => _menuService = menuService;

        [HttpGet]
        public async Task<IActionResult> GetMyMenus()
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            return Ok(await _menuService.GetByUserAsync(userId));
        }

        [HttpGet("all")]
        public async Task<IActionResult> GetAll() => Ok(await _menuService.GetAllAsync());
    }
}
