using Microsoft.AspNetCore.Mvc;
using TaskBoard.Server.Data;
using TaskBoard.Server.Models;

namespace TaskBoard.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CategoriesController : ControllerBase
    {
        private readonly ICategoryRepository _repository;

        public CategoriesController(ICategoryRepository repository)
        {
            _repository = repository;
        }

        [HttpGet]
        public async Task<IActionResult> GetByUser([FromQuery] Guid userId)
        {
            var categories = await _repository.GetByUserIdAsync(userId);
            return Ok(categories);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            var category = await _repository.GetByIdAsync(id);
            if (category is null) return NotFound();
            return Ok(category);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateCategoryRequest request)
        {
            await _repository.CreateAsync(request);
            var created = await _repository.GetByIdAsync(request.Id);
            return CreatedAtAction(nameof(GetById), new { id = request.Id }, created);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, [FromBody] UpdateCategoryRequest request)
        {
            var success = await _repository.UpdateAsync(id, request);
            if (!success) return NotFound();
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var success = await _repository.DeleteAsync(id);
            if (!success) return NotFound();
            return NoContent();
        }
    }
}