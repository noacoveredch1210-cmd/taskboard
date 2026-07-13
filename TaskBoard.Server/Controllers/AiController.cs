using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using TaskBoard.Server.Models;
using TaskBoard.Server.Services;

namespace TaskBoard.Server.Controllers
{
    // AI は有料/枠制限のある外部サービスを叩くため、他 API より厳しい "ai" レート制限をかける。
    [Route("api/[controller]")]
    [EnableRateLimiting("ai")]
    public class AiController : AuthorizedControllerBase
    {
        private readonly IAiAssistant _assistant;
        private readonly ILogger<AiController> _logger;

        public AiController(IAiAssistant assistant, ILogger<AiController> logger)
        {
            _assistant = assistant;
            _logger = logger;
        }

        // POST /api/ai/chat —— 使い方ガイドへの問い合わせ。
        [HttpPost("chat")]
        public async Task<IActionResult> Chat(
            [FromBody] AiChatRequest request,
            CancellationToken cancellationToken)
        {
            try
            {
                var reply = await _assistant.GetReplyAsync(request.Messages, cancellationToken);
                return Ok(new { reply });
            }
            catch (AiAssistantException ex)
            {
                // 詳細（キー未設定・上流ステータス等）はログに留め、クライアントには一般的な 503 を返す。
                _logger.LogError(ex, "AI アシスタントの呼び出しに失敗しました。");
                return StatusCode(StatusCodes.Status503ServiceUnavailable, new
                {
                    error = "AI アシスタントが一時的に利用できません。しばらくして再度お試しください。",
                });
            }
        }
    }
}
