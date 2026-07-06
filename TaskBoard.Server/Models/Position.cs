namespace TaskBoard.Server.Models
{
    public class Position
    {
        public Guid Id { get; set; }
        public Guid BoardId { get; set; }
        public string Name { get; set; } = string.Empty;
        public double OrderIndex { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
    }
}