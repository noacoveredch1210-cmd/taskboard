using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using TaskBoard.Server.Models;
using TaskBoard.Server.Services;

namespace TaskBoard.Server.Tests.Services
{
    public class GeminiAssistantTests : IDisposable
    {
        private readonly string? _originalKey =
            Environment.GetEnvironmentVariable("GEMINI_API_KEY");

        public void Dispose() =>
            Environment.SetEnvironmentVariable("GEMINI_API_KEY", _originalKey);

        /// <summary>要求を記録し、あらかじめ用意した応答を返すスタブ。</summary>
        private sealed class StubHandler : HttpMessageHandler
        {
            private readonly HttpStatusCode _status;
            private readonly string _body;
            public HttpRequestMessage? Captured { get; private set; }
            public string? CapturedBody { get; private set; }

            public StubHandler(HttpStatusCode status, string body)
            {
                _status = status;
                _body = body;
            }

            protected override async Task<HttpResponseMessage> SendAsync(
                HttpRequestMessage request, CancellationToken cancellationToken)
            {
                Captured = request;
                CapturedBody = request.Content is null
                    ? null
                    : await request.Content.ReadAsStringAsync(cancellationToken);
                return new HttpResponseMessage(_status)
                {
                    Content = new StringContent(_body, Encoding.UTF8, "application/json"),
                };
            }
        }

        private static GeminiAssistant Create(StubHandler handler) =>
            new(
                new HttpClient(handler)
                {
                    BaseAddress = new Uri("https://generativelanguage.googleapis.com/"),
                },
                NullLogger<GeminiAssistant>.Instance);

        private static readonly List<AiMessage> SampleMessages =
        [
            new() { Role = "assistant", Text = "こんにちは" },
            new() { Role = "user", Text = "ボードの作り方は？" },
        ];

        [Fact]
        public async Task 正常応答からテキストを取り出す()
        {
            Environment.SetEnvironmentVariable("GEMINI_API_KEY", "test-key");
            var handler = new StubHandler(HttpStatusCode.OK, """
                {"candidates":[{"content":{"parts":[{"text":"左上の＋から作成できます。"}]}}]}
                """);

            var reply = await Create(handler).GetReplyAsync(SampleMessages);

            Assert.Equal("左上の＋から作成できます。", reply);
        }

        [Fact]
        public async Task 要求にAPIキーとsystem_instructionを載せ_roleをmodelに変換する()
        {
            Environment.SetEnvironmentVariable("GEMINI_API_KEY", "secret-key");
            var handler = new StubHandler(HttpStatusCode.OK,
                """{"candidates":[{"content":{"parts":[{"text":"ok"}]}}]}""");

            await Create(handler).GetReplyAsync(SampleMessages);

            // API キーはヘッダーで送る（URL やボディには載せない）。
            Assert.True(handler.Captured!.Headers.Contains("x-goog-api-key"));
            Assert.Equal("secret-key",
                handler.Captured.Headers.GetValues("x-goog-api-key").Single());

            using var doc = JsonDocument.Parse(handler.CapturedBody!);
            var root = doc.RootElement;

            // 使い方ガイドのシステムプロンプトが載っている。
            Assert.True(root.TryGetProperty("system_instruction", out _));

            // "assistant" は Gemini の "model" にマッピングされる。
            var contents = root.GetProperty("contents");
            Assert.Equal("model", contents[0].GetProperty("role").GetString());
            Assert.Equal("user", contents[1].GetProperty("role").GetString());
        }

        [Fact]
        public async Task キー未設定なら例外を投げる()
        {
            Environment.SetEnvironmentVariable("GEMINI_API_KEY", null);
            var handler = new StubHandler(HttpStatusCode.OK, "{}");

            await Assert.ThrowsAsync<AiAssistantException>(
                () => Create(handler).GetReplyAsync(SampleMessages));
        }

        [Fact]
        public async Task 上流がエラーなら例外を投げる()
        {
            Environment.SetEnvironmentVariable("GEMINI_API_KEY", "test-key");
            var handler = new StubHandler(HttpStatusCode.TooManyRequests, "quota");

            await Assert.ThrowsAsync<AiAssistantException>(
                () => Create(handler).GetReplyAsync(SampleMessages));
        }

        [Fact]
        public async Task 候補が空なら例外を投げる()
        {
            Environment.SetEnvironmentVariable("GEMINI_API_KEY", "test-key");
            // 安全性フィルタで遮断された場合など。
            var handler = new StubHandler(HttpStatusCode.OK, """{"candidates":[]}""");

            await Assert.ThrowsAsync<AiAssistantException>(
                () => Create(handler).GetReplyAsync(SampleMessages));
        }
    }
}
