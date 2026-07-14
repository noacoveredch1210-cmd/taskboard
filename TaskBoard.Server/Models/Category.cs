namespace TaskBoard.Server.Models
{
    public class Category
    {
        public Guid Id { get; set; }
        /// <summary>所属するボード。カテゴリーはボード単位（共有ボードのメンバー全員が使う）。</summary>
        public Guid BoardId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Color { get; set; } = string.Empty;
        public DateTimeOffset CreatedAt { get; set; }
    }
}
