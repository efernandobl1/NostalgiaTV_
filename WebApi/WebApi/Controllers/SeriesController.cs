using ApplicationCore.DTOs.Series;
using ApplicationCore.Interfaces;
using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace WebApi.Controllers
{
    [ApiController]
    [ApiVersion("1.0")]
    [Route("api/v{version:apiVersion}/series")]
    public class SeriesController : ControllerBase
    {
        private readonly ISeriesService _seriesService;

        public SeriesController(ISeriesService seriesService)
        {
            _seriesService = seriesService;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll() => Ok(await _seriesService.GetAllAsync());

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id) => Ok(await _seriesService.GetByIdAsync(id));

        [HttpPost]
        public async Task<IActionResult> Create(SeriesRequest request) => Ok(await _seriesService.CreateAsync(request));

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, SeriesRequest request) => Ok(await _seriesService.UpdateAsync(id, request));

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            await _seriesService.DeleteAsync(id);
            return NoContent();
        }

        [HttpPost("{id}/categories")]
        public async Task<IActionResult> AssignCategories(int id, [FromBody] List<int> categoryIds) => Ok(await _seriesService.AssignCategoriesAsync(id, categoryIds));

        [HttpPost("{id}/scan")]
        public async Task<IActionResult> Scan(int id) => Ok(await _seriesService.ScanFolderAsync(id));
    }
}
