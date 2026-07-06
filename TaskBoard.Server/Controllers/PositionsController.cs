using Microsoft.AspNetCore.Mvc;
using TaskBoard.Server.Data;
using TaskBoard.Server.Models;

namespace TaskBoard.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PositionsController : ControllerBase
    {
        private readonly IPositionRepository _repository;

        public PositionsController(IPositionRepository repository)
        {
            _repository = repository;
        }

        [HttpGet]
        public async Task<IActionResult> GetByBoard([FromQuery] Guid boardId)
        {
            var positions = await _repository.GetByBoardIdAsync(boardId);
            return Ok(positions);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            var position = await _repository.GetByIdAsync(id);
            if (position is null) return NotFound();
            return Ok(position);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreatePositionRequest request)
        {
            await _repository.CreateAsync(request);
            var created = await _repository.GetByIdAsync(request.Id);
            return CreatedAtAction(nameof(GetById), new { id = request.Id }, created);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePositionRequest request)
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