using System.ComponentModel.DataAnnotations;

namespace TaskBoard.Server.Models
{
    /// <summary>ボードのメンバー 1 人分（表示用）。</summary>
    public class BoardMember
    {
        public Guid UserId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
    }

    /// <summary>共有リンクのトークンでボードに参加する要求。</summary>
    public class JoinBoardRequest
    {
        [Required]
        public Guid Token { get; set; }
    }

    /// <summary>メンバーの役割を変更する要求（オーナーが権限付与/降格するときに使う）。</summary>
    public class UpdateMemberRoleRequest
    {
        [Required]
        [RegularExpression("^(owner|member)$", ErrorMessage = "role は owner か member のみです。")]
        public string Role { get; set; } = string.Empty;
    }
}
