using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using TaskBoard.Server.Controllers;
using TaskBoard.Server.Models;
using TaskBoard.Server.Services;
using TaskBoard.Server.Tests.Support;

namespace TaskBoard.Server.Tests.Controllers
{
    public class AiControllerTests
    {
        private readonly IAiAssistant _assistant = Substitute.For<IAiAssistant>();
        private readonly Guid _userId = Guid.NewGuid();

        private AiController CreateController() =>
            new AiController(_assistant, NullLogger<AiController>.Instance).WithUser(_userId);

        private static AiChatRequest Request(params (string Role, string Text)[] messages) =>
            new()
            {
                Messages = messages
                    .Select(m => new AiMessage { Role = m.Role, Text = m.Text })
                    .ToList(),
            };

        [Fact]
        public async Task Chat_成功したら返信を返す()
        {
            _assistant
                .GetReplyAsync(Arg.Any<IReadOnlyList<AiMessage>>(), Arg.Any<CancellationToken>())
                .Returns("ボードは左上の＋から作成できます。");
            var controller = CreateController();

            var result = await controller.Chat(Request(("user", "ボードの作り方は？")), default);

            var ok = Assert.IsType<OkObjectResult>(result);
            Assert.Equal(
                "ボードは左上の＋から作成できます。",
                ok.Value!.GetType().GetProperty("reply")!.GetValue(ok.Value));
        }

        [Fact]
        public async Task Chat_会話履歴をそのままアシスタントへ渡す()
        {
            _assistant
                .GetReplyAsync(Arg.Any<IReadOnlyList<AiMessage>>(), Arg.Any<CancellationToken>())
                .Returns("はい");
            var controller = CreateController();

            await controller.Chat(
                Request(("assistant", "こんにちは"), ("user", "使い方は？")), default);

            await _assistant.Received(1).GetReplyAsync(
                Arg.Is<IReadOnlyList<AiMessage>>(m =>
                    m.Count == 2 && m[1].Role == "user" && m[1].Text == "使い方は？"),
                Arg.Any<CancellationToken>());
        }

        [Fact]
        public async Task Chat_アシスタントが失敗したら503を返す()
        {
            _assistant
                .GetReplyAsync(Arg.Any<IReadOnlyList<AiMessage>>(), Arg.Any<CancellationToken>())
                .ThrowsAsync(new AiAssistantException("GEMINI_API_KEY is not set."));
            var controller = CreateController();

            var result = await controller.Chat(Request(("user", "質問")), default);

            var status = Assert.IsType<ObjectResult>(result);
            Assert.Equal(503, status.StatusCode);
        }
    }
}
