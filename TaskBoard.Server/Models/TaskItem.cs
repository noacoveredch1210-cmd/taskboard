namespace TaskBoard.Server.Models
{
    public class TaskItem
    {
        public Guid Id { get; set; }
        public Guid BoardId { get; set; }
        public Guid? PositionId { get; set; }
        public Guid? CategoryId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Comment { get; set; }
        public int? Importance { get; set; }
        public DateOnly? Deadline { get; set; }
        public double OrderIndex { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
    }
}