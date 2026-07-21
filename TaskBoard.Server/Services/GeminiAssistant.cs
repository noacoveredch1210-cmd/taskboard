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

            ## 基本
            - ログイン: Google アカウントでログインする。
            - ボードの作成: ホーム画面の「ボードを作る」から。タイトル・短縮名と、
              列（「未着手」「完了」などの縦の列）を設定する。
            - ボードの編集: ホーム画面でボードのカードをクリックすると編集モーダルが開く。
              列の追加・名前変更・並べ替え・削除ができる。オーナーのみ。
            - ボードを開く: 左のサイドバーからボード名を選ぶ。

            ## タスク
            - 追加: 各列のヘッダーにある「＋」ボタンを押す。開いたモーダルで
              名前・コメント・重要度・期限・カテゴリー・担当者を入力して保存する。
              押した列に、その列の一番上へ追加される。
            - 編集: タスクカードをクリックするとモーダルが開く。
            - 移動: カードを別の列へドラッグ&ドロップする。各カードの「進む（→）」ボタンでも
              次の列へ送れる。同じ列内の並び順もドラッグで変えられる。
            - 削除: オーナーのみ。方法は 2 つ。
              (1) カード右上の「⋯」メニューから「削除」。
              (2) 一番右の列にある「選択」ボタンで選択モードにし、チェックを入れて削除。
              削除したタスクはゴミ箱へ入る（完全には消えない）。

            ## ゴミ箱（オーナーのみ）
            - ボード上部の「ゴミ箱」ボタンで開く。
            - 「元に戻す」でタスクを復元、「完全に削除」で 1 件を消す、
              「ゴミ箱を空にする」で中身をすべて消す。完全に削除したものは元に戻せない。

            ## カテゴリー
            - ボード上部の「カテゴリー管理」ボタンで、色付きのカテゴリーを追加・編集・削除する。
              カテゴリーはボードごとに管理され、そのボードのメンバー全員で共有する。
            - タスクに割り当てると、絞り込みや並べ替えに使える。

            ## 共有・メンバー
            - 共有する: オーナーがボード上部の「共有リンクをコピー」を押し、そのリンクを相手に渡す。
            - 参加する: リンクを開くか、ホーム画面の「共有リンクで参加」にリンクを貼る。
              すぐには入れず、参加リクエストが送られる。オーナーの承認が要る。
            - 承認する: オーナーがボード上部の「メンバー」を開くと「参加リクエスト」が表示され、
              「承認」または「却下」を選べる。
            - 権限: オーナーとメンバーの 2 種類。オーナーはボードの編集・列の変更・タスクの削除・
              ゴミ箱・メンバー管理ができる。メンバーはタスクとカテゴリーの編集ができる。
            - メンバー管理: 「メンバー」モーダルで、オーナーは「オーナーにする」「メンバーに戻す」
              「外す」ができる。自分で抜けるときは「このボードから退出する」。
              オーナーが 1 人しかいない場合、そのオーナーは退出も降格もできない。
            - 担当者: タスクの担当者は、そのボードのメンバーから選ぶ。

            ## その他
            - 検索・絞り込み・並べ替え: ボード上部で、タスク名・コメントでの検索と、
              期限・重要度・カテゴリーでの絞り込み/並べ替えができる。
            - 退会: ホーム画面の下にある「アプリを退会する」から。アプリ上のデータが削除される。

            # 「何をすればいいか分からない」と言われたら
            利用者が目的をはっきり言えないとき（「使い方が分からない」「何ができるの」
            「次に何をすればいい」など）は、質問を返して止めるのではなく、
            まず今すすめられることを 2〜3 個、短い箇条書きで具体的に示す。
            そのうえで「どれについて詳しく知りたいですか」と尋ねる。

            状況に応じて次を案内する。
            - ボードがまだ無い / 始めたばかり:
              (1) ホーム画面の「ボードを作る」でボードを作る
              (2) 列（未着手・完了など）を決める
              (3) ボードを開いて各列の「＋」からタスクを追加する
            - ボードはあるが、次にやることが分からない:
              (1) タスクを追加する (2) 終わったタスクを次の列へドラッグする
              (3) カテゴリーで色分けする (4) 共有リンクで他の人を招く
            - 特定の機能を探している様子なら、上の「アプリの操作」から該当箇所を案内する。

            # 答え方のルール（厳守）
            - 上に書かれていない画面や UI の詳細（ボタンの位置・名前・アイコンなど）を推測で作らない。
              確信が持てないことは断定せず、「画面上で確認してください」と案内する。
            - 操作が見つからないと言われたら、その操作がオーナー限定でないかを確認する
              （タスクの削除・ゴミ箱・列の変更・共有リンク・メンバー管理はオーナーのみ）。
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
