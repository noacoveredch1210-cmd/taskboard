using System.ComponentModel.DataAnnotations;

namespace TaskBoard.Server.Models
{
    /// <summary>
    /// AI 使い方ガイドへのチャット要求。会話履歴をそのまま送る（ステートレス）。
    /// 個人データは含めない設計 —— 送るのはユーザーが打った文面だけ。
    /// </summary>
    public class AiChatRequest
    {
        /// <summary>会話履歴。古い順。コスト・悪用対策で件数と長さを制限する。</summary>
        [Required]
        [MinLength(1, ErrorMessage = "メッセージが空です。")]
        [MaxLength(AiLimits.MaxMessages, ErrorMessage = "会話が長すぎます。")]
        public List<AiMessage> Messages { get; set; } = [];
    }

    public class AiMessage
    {
        /// <summary>"user" または "assistant"。</summary>
        [Required]
        [RegularExpression("^(user|assistant)$", ErrorMessage = "role は user か assistant のみです。")]
        public string Role { get; set; } = string.Empty;

        [Required]
        [MaxLength(AiLimits.MaxMessageLength, ErrorMessage = "メッセージが長すぎます。")]
        public string Text { get; set; } = string.Empty;
    }

    public static class AiLimits
    {
        /// <summary>1 リクエストで送れる会話の最大件数。</summary>
        public const int MaxMessages = 20;

        /// <summary>1 メッセージの最大文字数。</summary>
        public const int MaxMessageLength = 1000;

        /// <summary>応答の最大トークン数（使い方ガイドなので短く抑える）。</summary>
        public const int MaxOutputTokens = 1024;
    }
}
