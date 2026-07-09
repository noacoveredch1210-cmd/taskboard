using System.ComponentModel.DataAnnotations;

namespace TaskBoard.Server.Models
{
    public class CreatePositionRequest
    {
        public Guid Id { get; set; }
        public Guid BoardId { get; set; }
        [MaxLength(TextLimits.PositionName)]
        public string Name { get; set; } = string.Empty;
        public double OrderIndex { get; set; }
    }

    public class UpdatePositionRequest
    {
        [MaxLength(TextLimits.PositionName)]
        public string Name { get; set; } = string.Empty;
        public double OrderIndex { get; set; }
    }
}
