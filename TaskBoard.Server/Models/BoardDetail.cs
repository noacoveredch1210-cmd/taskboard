namespace TaskBoard.Server.Models
{
    /// <summary>
    /// ボードと、その中身（列・タスク・カテゴリー・メンバー）をひとまとめにしたもの。
    ///
    /// 画面はボードを開いた瞬間に中身を全部使うので、分けて返すとクライアントが
    /// ボードごとに 4 本の追加リクエストを投げることになる（ボード N 枚で 1+4N 本）。
    /// まとめて返せば 1 本で済み、レート制限も起動時の待ち時間も軽くなる。
    /// </summary>
    public class BoardDetail
    {
        public Guid Id { get; set; }
        public string ShortName { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        /// <summary>リクエストしたユーザーのこのボードでの役割（"owner" / "member"）。</summary>
        public string Role { get; set; } = string.Empty;
        public DateTimeOffset CreatedAt { get; set; }

        public List<Position> Positions { get; set; } = [];
        public List<TaskItem> Tasks { get; set; } = [];
        public List<Category> Categories { get; set; } = [];
        public List<BoardMember> Members { get; set; } = [];
    }

    /// <summary>まとめ取得の内部用。どのボードのメンバーかを持たせて後で振り分ける。</summary>
    internal class BoardMemberRow : BoardMember
    {
        public Guid BoardId { get; set; }
    }
}
