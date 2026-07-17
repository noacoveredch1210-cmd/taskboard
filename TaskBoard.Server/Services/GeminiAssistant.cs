using System.Diagnostics;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using TaskBoard.Server.Models;

namespace TaskBoard.Server.Services
{
    /// <summary>
    /// Google Gemini（無料枠）を使った使い方ガイド。使用モデルは <see cref="Model"/>。
    /// API キーはサーバー側の環境変数 GEMINI_API_KEY にのみ置き、クライアントには出さない。
    /// </summary>
    public class GeminiAssistant : IAiAssistant
    {
        // 無料枠で使える軽量・高速モデル。使い方ガイドの Q&A には十分で、公開デモでも
        // 無料枠の余裕が大きい。system_instruction に対応（v1beta）。
        private const string Model = "gemini-2.5-flash-lite";

        // 使い方ガイドの範囲に閉じる。ユーザーの実データは一切渡さない。
        // ここに書かれた操作だけが正しい仕様。モデルが UI 詳細を捏造しないよう明示する。
        private const string SystemPrompt = """
            あなたは「TaskBoard」というカンバン形式のタスク管理アプリの使い方を案内するアシスタントです。
            日本語で、簡潔に、手順は短い箇条書きで答えてください。

            # アプリの操作（これが唯一の正しい仕様）
            - ログイン: Google アカウントでログインする。
            - ボードの作成・編集: ホーム画面で行う。ボードのモーダルで、タイトル・短縮名と、
              列（「未着手」「完了」などの縦の列）の追加・名前変更・並べ替え・削除ができる。
            - タスクの追加: ボードを開き、一番左（先頭）の列のヘッダーにある「＋」ボタンを押す。
              開いたモーダルで名前・コメント・重要度・期限・カテゴリーを入力して保存する。
              新しいタスクは先頭の列に追加される。
            - タスクの編集: タスクカードをクリックするとモーダルが開き、内容を編集できる。
            - タスクの移動: カードを別の列へドラッグ&ドロップする。各カードにある「進む（→）」ボタンでも
              次の列へ送れる。同じ列内の並び順もドラッグで変えられる。
            - タスクの削除: 一番右（末尾）の列にある選択ボタンで選択モードにし、
              削除したいタスクにチェックを入れて削除する。
            - カテゴリー: ホーム画面で色付きのカテゴリーを作成・管理する。タスクに割り当て、
              ボード内の絞り込みや並べ替えに使う。
            - 検索・絞り込み・並べ替え: ボード上部で、タスク名での検索と、
              期限・重要度・カテゴリーでの絞り込み/並べ替えができる。

            # 答え方のルール（厳守）
            - 上に書かれていない画面や UI の詳細（ボタンの位置・名前・アイコンなど）を推測で作らない。
              確信が持てないことは断定せず、「画面上で確認してください」と案内する。
            - TaskBoard の使い方に関係ない質問（雑談・一般知識・コード生成など）には、
              「TaskBoard の使い方についてお答えします」と丁寧に断り、深入りしない。
            - 個々のユーザーのボードやタスクの中身は見えない。中身を聞かれたら、画面で確認する方法を案内する。
            """;

        private readonly HttpClient _http;
        private readonly ILogger<GeminiAssistant> _logger;

        public GeminiAssistant(HttpClient http, ILogger<GeminiAssistant> logger)
        {
            _http = http;
            _logger = logger;
        }

        public async Task<string> GetReplyAsync(
            IReadOnlyList<AiMessage> messages,
            CancellationToken cancellationToken = default)
        {
            var apiKey = Environment.GetEnvironmentVariable("GEMINI_API_KEY");
            if (string.IsNullOrEmpty(apiKey))
            {
                throw new AiAssistantException("GEMINI_API_KEY is not set.");
            }

            var payload = new GeminiRequest
            {
                SystemInstruction = new GeminiContent
                {
                    Parts = [new GeminiPart { Text = SystemPrompt }],
                },
                // クライアントの "assistant" を Gemini の "model" にマッピングする。
                Contents = messages
                    .Select(m => new GeminiContent
                    {
                        Role = m.Role == "assistant" ? "model" : "user",
                        Parts = [new GeminiPart { Text = m.Text }],
                    })
                    .ToList(),
                GenerationConfig = new GeminiGenerationConfig
                {
                    MaxOutputTokens = AiLimits.MaxOutputTokens,
                    Temperature = 0.7,
                },
            };

            // 上流（Gemini）にかかった時間を残す。これが無いと「/api/ai/chat が 3 秒」までは
            // 分かっても、その内訳が上流なのか自前の処理なのかを切り分けられない。
            // 同じリクエストのログとは TraceId で繋がる。
            var stopwatch = Stopwatch.StartNew();
            HttpResponseMessage response;
            try
            {
                using var request = new HttpRequestMessage(
                    HttpMethod.Post,
                    $"v1beta/models/{Model}:generateContent");
                request.Headers.Add("x-goog-api-key", apiKey);
                request.Content = JsonContent.Create(payload, options: JsonOptions);

                response = await _http.SendAsync(request, cancellationToken);
            }
            catch (HttpRequestException ex)
            {
                _logger.LogWarning(
                    "Gemini へ接続できませんでした {Model} {ElapsedMs}ms",
                    Model, stopwatch.ElapsedMilliseconds);
                throw new AiAssistantException("AI サービスへ接続できませんでした。", ex);
            }

            _logger.LogInformation(
                "Gemini へ問い合わせました {Model} {StatusCode} {ElapsedMs}ms {MessageCount}件",
                Model, (int)response.StatusCode, stopwatch.ElapsedMilliseconds, messages.Count);

            if (!response.IsSuccessStatusCode)
            {
                // 上流のエラー本文はそのままクライアントへ出さない（キーや内部情報の漏洩を避ける）。
                throw new AiAssistantException(
                    $"AI サービスがエラーを返しました（{(int)response.StatusCode}）。");
            }

            var body = await response.Content.ReadFromJsonAsync<GeminiResponse>(
                JsonOptions, cancellationToken);

            var text = body?.Candidates?
                .FirstOrDefault()?.Content?.Parts?
                .FirstOrDefault()?.Text;

            if (string.IsNullOrWhiteSpace(text))
            {
                // 安全性フィルタでの遮断や空応答。ユーザーには無難な案内を返す。
                throw new AiAssistantException("AI から有効な応答が得られませんでした。");
            }

            return text.Trim();
        }

        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        };

        // ---- Gemini REST の最小 DTO ----

        private class GeminiRequest
        {
            [JsonPropertyName("system_instruction")]
            public GeminiContent? SystemInstruction { get; set; }

            [JsonPropertyName("contents")]
            public List<GeminiContent> Contents { get; set; } = [];

            [JsonPropertyName("generationConfig")]
            public GeminiGenerationConfig? GenerationConfig { get; set; }
        }

        private class GeminiContent
        {
            [JsonPropertyName("role")]
            public string? Role { get; set; }

            [JsonPropertyName("parts")]
            public List<GeminiPart> Parts { get; set; } = [];
        }

        private class GeminiPart
        {
            [JsonPropertyName("text")]
            public string Text { get; set; } = string.Empty;
        }

        private class GeminiGenerationConfig
        {
            [JsonPropertyName("maxOutputTokens")]
            public int MaxOutputTokens { get; set; }

            [JsonPropertyName("temperature")]
            public double Temperature { get; set; }
        }

        private class GeminiResponse
        {
            [JsonPropertyName("candidates")]
            public List<GeminiCandidate>? Candidates { get; set; }
        }

        private class GeminiCandidate
        {
            [JsonPropertyName("content")]
            public GeminiContent? Content { get; set; }
        }
    }
}
