using Microsoft.AspNetCore.Mvc;
using TaskBoard.Server.Data;
using TaskBoard.Server.Models;

namespace TaskBoard.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class BoardsController : ControllerBase
    {
        private readonly IBoardRepository _repository;

        public BoardsController(IBoardRepository repository)
        {
            _repository = repository;
        }

        // GET /api/boards?userId=xxx
        [HttpGet]
        public async Task<IActionResult> GetByUser([FromQuery] Guid userId)
        {
            var boards = await _repository.GetByUserIdAsync(userId);
            return Ok(boards);
        }

        // GET /api/boards/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            var board = await _repository.GetByIdAsync(id);
            if (board is null) return NotFound();
            return Ok(board);
        }

        // POST /api/boards
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateBoardRequest request)
        {
            await _repository.CreateAsync(request);
            var created = await _repository.GetByIdAsync(request.Id);
            return CreatedAtAction(nameof(GetById), new { id = request.Id }, created);
        }

        // PUT /api/boards/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, [FromBody] UpdateBoardRequest request)
        {
            var success = await _repository.UpdateAsync(id, request);
            if (!success) return NotFound();
            return NoContent();
        }

        // DELETE /api/boards/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var success = await _repository.DeleteAsync(id);
            if (!success) return NotFound();
            return NoContent();
        }
    }
}