using Microsoft.AspNetCore.Mvc;
using TaskBoard.Server.Data;
using TaskBoard.Server.Models;

namespace TaskBoard.Server.Controllers
{
    [Route("api/[controller]")]
    public class BoardsController : AuthorizedControllerBase
    {
        private readonly IBoardRepository _repository;

        public BoardsController(IBoardRepository repository)
        {
            _repository = repository;
        }

        // GET /api/boards （認証ユーザー自身の board 一覧）
        [HttpGet]
        public async Task<IActionResult> GetMine()
        {
            var boards = await _repository.GetByUserIdAsync(CurrentUserId);
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
            // 所有者は必ずトークンのユーザーに固定する（body の値は信用しない）。
            request.UserId = CurrentUserId;
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