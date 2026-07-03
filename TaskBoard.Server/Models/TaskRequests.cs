namespace TaskBoard.Server.Models;

public class CreateTaskRequest
{
    public Guid Id { get; set; }
    public Guid BoardId { get; set; }
    public Guid? PositionId { get; set; }
    public Guid? CategoryId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Comment { get; set; }
    public int? Importance { get; set; }
    public DateOnly? Deadline { get; set; }
}

public class UpdateTaskRequest
{
    public Guid? PositionId { get; set; }
    public Guid? CategoryId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Comment { get; set; }
    public int? Importance { get; set; }
    public DateOnly? Deadline { get; set; }
}