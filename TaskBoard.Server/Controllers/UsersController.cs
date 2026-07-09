using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using TaskBoard.Server.Data;
using TaskBoard.Server.Models;

namespace TaskBoard.Server.Controllers
{
    [Route("api/[controller]")]
    public class UsersController : AuthorizedControllerBase
    {
        private readonly IUserRepository _repository;

        public UsersController(IUserRepository repository)
        {
            _repository = repository;
        }

        // GET /api/users/me
        // 認証済みユーザー自身の情報を返す。初回ログイン時は JWT のクレームから
        // users レコードを作成（upsert）する。フロントは常にこれを呼べばよい。
        [HttpGet("me")]
        public async Task<IActionResult> GetMe()
        {
            var email = User.FindFirstValue("email") ?? string.Empty;
            var name = ResolveName(User) ?? email;

            await _repository.EnsureAsync(CurrentUserId, name, email);
            var user = await _repository.GetByIdAsync(CurrentUserId);
            return Ok(user);
        }

        // PUT /api/users/me
        [HttpPut("me")]
        public async Task<IActionResult> UpdateMe([FromBody] UpdateUserRequest request)
        {
            var success = await _repository.UpdateAsync(CurrentUserId, request);
            if (!success) return NotFound();
            return NoContent();
        }

        /// <summary>
        /// Supabase JWT の user_metadata（JSON 文字列クレーム）から表示名を取り出す。
        /// Google ログインでは full_name / name に氏名が入る。
        /// </summary>
        private static string? ResolveName(ClaimsPrincipal user)
        {
            var metaJson = user.FindFirstValue("user_metadata");
            if (string.IsNullOrEmpty(metaJson)) return null;

            try
            {
                using var doc = JsonDocument.Parse(metaJson);
                var root = doc.RootElement;
                // TryGetProperty はオブジェクト以外に対して InvalidOperationException を投げる。
                if (root.ValueKind != JsonValueKind.Object) return null;

                foreach (var key in new[] { "full_name", "name" })
                {
                    if (root.TryGetProperty(key, out var value)
                        && value.ValueKind == JsonValueKind.String)
                    {
                        var name = value.GetString();
                        if (!string.IsNullOrWhiteSpace(name)) return name;
                    }
                }
            }
            catch (JsonException)
            {
                // メタデータが想定外の形式でも表示名なしとして扱う
            }
            return null;
        }
    }
}
