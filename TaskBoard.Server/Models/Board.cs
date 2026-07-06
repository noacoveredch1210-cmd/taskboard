namespace TaskBoard.Server.Models
{
    public class Board
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public string ShortName { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public DateTimeOffset CreatedAt { get; set; }
    }
}