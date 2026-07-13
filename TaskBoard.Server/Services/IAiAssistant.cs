using TaskBoard.Server.Models;

namespace TaskBoard.Server.Services
{
    /// <summary>使い方ガイドの応答を生成する。実装は LLM プロバイダに依存する。</summary>
    public interface IAiAssistant
    {
        /// <summary>会話履歴に対する応答テキストを返す。</summary>
        Task<string> GetReplyAsync(IReadOnlyList<AiMessage> messages, CancellationToken cancellationToken = default);
    }

    /// <summary>AI プロバイダ側の障害（キー未設定・上流エラーなど）を表す。</summary>
    public class AiAssistantException : Exception
    {
        public AiAssistantException(string message, Exception? inner = null) : base(message, inner) { }
    }
}
