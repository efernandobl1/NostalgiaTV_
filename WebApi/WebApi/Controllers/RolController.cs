using ApplicationCore.DTOs.Rol;
using ApplicationCore.Interfaces;
using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace WebApi.Controllers
{
    [ApiController]
    [Authorize]
    [ApiVersion("1")]
    [Route("api/v{version:apiVersion}/roles")]
    public class RolController : ControllerBase
    {
        private readonly IRolService _rolService;

        public RolController(IRolService rolService) => _rolService = rolService;

        [HttpGet]
        public async Task<IActionResult> GetAll() => Ok(await _rolService.GetAllAsync());

        [HttpPost]
        public async Task<IActionResult> Create(RolRequest request) => Ok(await _rolService.CreateAsync(request));

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, RolRequest request) => Ok(await _rolService.UpdateAsync(id, request));

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            await _rolService.DeleteAsync(id);
            return NoContent();
        }
    }
}
