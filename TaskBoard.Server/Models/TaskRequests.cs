using System.ComponentModel.DataAnnotations;

namespace TaskBoard.Server.Models
{
    public class CreateTaskRequest
    {
        public Guid Id { get; set; }
        public Guid BoardId { get; set; }
        public Guid? PositionId { get; set; }
        public Guid? CategoryId { get; set; }
        [MaxLength(TextLimits.TaskName)]
        public string Name { get; set; } = string.Empty;
        [MaxLength(TextLimits.TaskComment)]
        public string? Comment { get; set; }
        [Range(TextLimits.ImportanceMin, TextLimits.ImportanceMax)]
        public int? Importance { get; set; }
        public DateOnly? Deadline { get; set; }
        public double OrderIndex { get; set; }
    }

    public class UpdateTaskRequest
    {
        public Guid? PositionId { get; set; }
        public Guid? CategoryId { get; set; }
        [MaxLength(TextLimits.TaskName)]
        public string Name { get; set; } = string.Empty;
        [MaxLength(TextLimits.TaskComment)]
        public string? Comment { get; set; }
        [Range(TextLimits.ImportanceMin, TextLimits.ImportanceMax)]
        public int? Importance { get; set; }
        public DateOnly? Deadline { get; set; }
        public double OrderIndex { get; set; }
    }
}
