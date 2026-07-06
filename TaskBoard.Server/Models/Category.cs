namespace TaskBoard.Server.Models
{
    public class Category
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Color { get; set; } = string.Empty;
        public DateTimeOffset CreatedAt { get; set; }
    }
}