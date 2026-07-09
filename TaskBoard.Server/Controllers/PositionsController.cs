using Microsoft.AspNetCore.Mvc;
using TaskBoard.Server.Data;
using TaskBoard.Server.Models;

namespace TaskBoard.Server.Controllers
{
    [Route("api/[controller]")]
    public class PositionsController : AuthorizedControllerBase
    {
        private readonly IPositionRepository _repository;

        public PositionsController(IPositionRepository repository)
        {
            _repository = repository;
        }

        // GET /api/positions?boardId=xxx
        // 他人の board を指定しても空配列になる（board の実在を漏らさない）。
        [HttpGet]
        public async Task<IActionResult> GetByBoard([FromQuery] Guid boardId)
        {
            var positions = await _repository.GetByBoardIdAsync(boardId, CurrentUserId);
            return Ok(positions);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            var position = await _repository.GetByIdAsync(id, CurrentUserId);
            if (position is null) return NotFound();
            return Ok(position);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreatePositionRequest request)
        {
            // 自分が所有しない board には作成できない。
            var created = await _repository.CreateAsync(request, CurrentUserId);
            if (!created) return NotFound();

            var position = await _repository.GetByIdAsync(request.Id, CurrentUserId);
            return CreatedAtAction(nameof(GetById), new { id = request.Id }, position);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePositionRequest request)
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
