namespace TaskBoard.Server.Models
{
    public class Board
    {
        public Guid Id { get; set; }
        /// <summary>作成者。アクセス判定には使わない（board_members で判定する）。</summary>
        public Guid UserId { get; set; }
        public string ShortName { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        /// <summary>リクエストしたユーザーのこのボードでの役割（"owner" / "member"）。</summary>
        public string Role { get; set; } = string.Empty;
        public DateTimeOffset CreatedAt { get; set; }
    }
}
