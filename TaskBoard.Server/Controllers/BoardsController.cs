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

        // GET /api/boards （認証ユーザーが参加している board 一覧）
        [HttpGet]
        public async Task<IActionResult> GetMine()
        {
            var boards = await _repository.GetForUserAsync(CurrentUserId);
            return Ok(boards);
        }

        // GET /api/boards/{id}
        // 参加していない board は存在を伏せるため 404 を返す（403 だと id の実在が漏れる）。
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            var board = await _repository.GetByIdAsync(id, CurrentUserId);
            if (board is null) return NotFound();
            return Ok(board);
        }

        // POST /api/boards
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateBoardRequest request)
        {
            // 作成者は必ずトークンのユーザーに固定する（body の値は信用しない）。
            request.UserId = CurrentUserId;
            await _repository.CreateAsync(request);
            var created = await _repository.GetByIdAsync(request.Id, CurrentUserId);
            return CreatedAtAction(nameof(GetById), new { id = request.Id }, created);
        }

        // PUT /api/boards/{id} （メンバーなら更新可）
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, [FromBody] UpdateBoardRequest request)
        {
            var success = await _repository.UpdateAsync(id, CurrentUserId, request);
            if (!success) return NotFound();
            return NoContent();
        }

        // DELETE /api/boards/{id} （オーナーのみ）
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var success = await _repository.DeleteAsync(id, CurrentUserId);
            if (!success) return NotFound();
            return NoContent();
        }

        // GET /api/boards/{id}/share （共有トークン。オーナーのみ）
        [HttpGet("{id}/share")]
        public async Task<IActionResult> GetShareToken(Guid id)
        {
            var token = await _repository.GetShareTokenAsync(id, CurrentUserId);
            if (token is null) return NotFound();
            return Ok(new { shareToken = token });
        }

        // POST /api/boards/join （共有トークンで参加リクエストを出す。承認制）
        [HttpPost("join")]
        public async Task<IActionResult> Join([FromBody] JoinBoardRequest request)
        {
            var outcome = await _repository.RequestJoinByTokenAsync(request.Token, CurrentUserId);
            if (outcome.Result == JoinResult.NotFound) return NotFound();

            if (outcome.Result == JoinResult.AlreadyMember)
            {
                // 既にメンバーなら承認不要。そのまま board を返す。
                var board = await _repository.GetByIdAsync(outcome.BoardId!.Value, CurrentUserId);
                return Ok(new { status = "member", board });
            }

            // 承認待ち。
            return Ok(new { status = "requested" });
        }

        // GET /api/boards/{id}/requests （保留中の参加リクエスト。オーナーのみ）
        [HttpGet("{id}/requests")]
        public async Task<IActionResult> GetJoinRequests(Guid id)
        {
            var requests = await _repository.GetJoinRequestsAsync(id, CurrentUserId);
            return Ok(requests);
        }

        // POST /api/boards/{id}/requests/{userId}/approve （オーナーが承認）
        [HttpPost("{id}/requests/{userId}/approve")]
        public async Task<IActionResult> ApproveJoinRequest(Guid id, Guid userId)
        {
            var success = await _repository.ApproveJoinRequestAsync(id, CurrentUserId, userId);
            if (!success) return NotFound();
            return NoContent();
        }

        // DELETE /api/boards/{id}/requests/{userId} （オーナーが却下）
        [HttpDelete("{id}/requests/{userId}")]
        public async Task<IActionResult> RejectJoinRequest(Guid id, Guid userId)
        {
            var success = await _repository.RejectJoinRequestAsync(id, CurrentUserId, userId);
            if (!success) return NotFound();
            return NoContent();
        }

        // GET /api/boards/{id}/members （メンバー一覧。メンバーのみ）
        [HttpGet("{id}/members")]
        public async Task<IActionResult> GetMembers(Guid id)
        {
            if (await _repository.GetByIdAsync(id, CurrentUserId) is null) return NotFound();
            var members = await _repository.GetMembersAsync(id, CurrentUserId);
            return Ok(members);
        }

        // DELETE /api/boards/{id}/members/{userId}
        // オーナーは他人を外せる。本人はいつでも退出できる（オーナー自身は外せない）。
        [HttpDelete("{id}/members/{userId}")]
        public async Task<IActionResult> RemoveMember(Guid id, Guid userId)
        {
            var success = await _repository.RemoveMemberAsync(id, CurrentUserId, userId);
            if (!success) return NotFound();
            return NoContent();
        }

        // POST /api/boards/{id}/leave （自分がこのボードから退出する）
        // オーナーは退出できない（ボードを削除するか、他者にオーナーを譲ってから抜ける）。
        [HttpPost("{id}/leave")]
        public async Task<IActionResult> Leave(Guid id)
        {
            var success = await _repository.RemoveMemberAsync(id, CurrentUserId, CurrentUserId);
            if (!success) return NotFound();
            return NoContent();
        }

        // PUT /api/boards/{id}/members/{userId}
        // メンバーの役割を変更する（オーナーのみ。最後のオーナーは降格不可）。
        [HttpPut("{id}/members/{userId}")]
        public async Task<IActionResult> SetMemberRole(
            Guid id, Guid userId, [FromBody] UpdateMemberRoleRequest request)
        {
            var success = await _repository.SetMemberRoleAsync(id, CurrentUserId, userId, request.Role);
            if (!success) return NotFound();
            return NoContent();
        }
    }
}
