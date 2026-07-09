using Microsoft.AspNetCore.Mvc;
using TaskBoard.Server.Data;
using TaskBoard.Server.Models;

namespace TaskBoard.Server.Controllers
{
    [Route("api/[controller]")]
    public class CategoriesController : AuthorizedControllerBase
    {
        private readonly ICategoryRepository _repository;

        public CategoriesController(ICategoryRepository repository)
        {
            _repository = repository;
        }

        // GET /api/categories （認証ユーザー自身のカテゴリー一覧）
        [HttpGet]
        public async Task<IActionResult> GetMine()
        {
            var categories = await _repository.GetByUserIdAsync(CurrentUserId);
            return Ok(categories);
        }

        // 他人の category は存在を伏せるため 404 を返す（403 だと id の実在が漏れる）。
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            var category = await _repository.GetByIdAsync(id, CurrentUserId);
            if (category is null) return NotFound();
            return Ok(category);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateCategoryRequest request)
        {
            // 所有者は必ずトークンのユーザーに固定する（body の値は信用しない）。
            request.UserId = CurrentUserId;
            await _repository.CreateAsync(request);
            var created = await _repository.GetByIdAsync(request.Id, CurrentUserId);
            return CreatedAtAction(nameof(GetById), new { id = request.Id }, created);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, [FromBody] UpdateCategoryRequest request)
        {
            var success = await _repository.UpdateAsync(id, CurrentUserId, request);
            if (!success) return NotFound();
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var success = await _repository.DeleteAsync(id, CurrentUserId);
            if (!success) return NotFound();
            return NoContent();
        }
    }
}
