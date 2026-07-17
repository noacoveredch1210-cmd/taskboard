using Microsoft.AspNetCore.Mvc;
using TaskBoard.Server.Data;
using TaskBoard.Server.Models;

namespace TaskBoard.Server.Controllers
{
    [Route("api/[controller]")]
    public class TasksController : AuthorizedControllerBase
    {
        private readonly ITaskRepository _repository;

        public TasksController(ITaskRepository repository)
        {
            _repository = repository;
        }

        // GET /api/tasks?boardId=xxx
        // 他人の board を指定しても空配列になる（board の実在を漏らさない）。
        [HttpGet]
        public async Task<IActionResult> GetByBoard([FromQuery] Guid boardId)
        {
            var tasks = await _repository.GetByBoardIdAsync(boardId, CurrentUserId);
            return Ok(tasks);
        }

        // GET /api/tasks/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            var task = await _repository.GetByIdAsync(id, CurrentUserId);
            if (task is null) return NotFound();
            return Ok(task);
        }

        // POST /api/tasks
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateTaskRequest request)
        {
            // 自分が所有しない board、および不正な position / category 割り当ては拒否する。
            var created = await _repository.CreateAsync(request, CurrentUserId);
            if (!created) return NotFound();

            var task = await _repository.GetByIdAsync(request.Id, CurrentUserId);
            return CreatedAtAction(nameof(GetById), new { id = request.Id }, task);
        }

        // PUT /api/tasks/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, [FromBody] UpdateTaskRequest request)
        {
            var success = await _repository.UpdateAsync(id, CurrentUserId, request);
            if (!success) return NotFound();
            return NoContent();
        }

        // POST /api/tasks/{id}/move （並べ替え。order_index はサーバーが採番する）
        [HttpPost("{id}/move")]
        public async Task<IActionResult> Move(Guid id, [FromBody] MoveTaskRequest request)
        {
            var success = await _repository.MoveAsync(id, CurrentUserId, request);
            if (!success) return NotFound();
            return NoContent();
        }

        // DELETE /api/tasks/{id} （ゴミ箱へ移す。オーナーのみ）
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var success = await _repository.DeleteAsync(id, CurrentUserId);
            if (!success) return NotFound();
            return NoContent();
        }

        // GET /api/tasks/trash?boardId=xxx （ゴミ箱一覧。オーナーのみ）
        [HttpGet("trash")]
        public async Task<IActionResult> GetTrash([FromQuery] Guid boardId)
        {
            var tasks = await _repository.GetTrashByBoardIdAsync(boardId, CurrentUserId);
            return Ok(tasks);
        }

        // POST /api/tasks/{id}/restore （ゴミ箱から戻す。オーナーのみ）
        [HttpPost("{id}/restore")]
        public async Task<IActionResult> Restore(Guid id)
        {
            var success = await _repository.RestoreAsync(id, CurrentUserId);
            if (!success) return NotFound();
            return NoContent();
        }

        // DELETE /api/tasks/{id}/purge （ゴミ箱から完全に削除。オーナーのみ）
        [HttpDelete("{id}/purge")]
        public async Task<IActionResult> Purge(Guid id)
        {
            var success = await _repository.PurgeAsync(id, CurrentUserId);
            if (!success) return NotFound();
            return NoContent();
        }

        // DELETE /api/tasks/trash?boardId=xxx （ゴミ箱を空にする。オーナーのみ）
        [HttpDelete("trash")]
        public async Task<IActionResult> PurgeAll([FromQuery] Guid boardId)
        {
            var success = await _repository.PurgeAllAsync(boardId, CurrentUserId);
            if (!success) return NotFound();
            return NoContent();
        }
    }
}
