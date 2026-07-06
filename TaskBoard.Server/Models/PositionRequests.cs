namespace TaskBoard.Server.Models
{
    public class CreatePositionRequest
    {
        public Guid Id { get; set; }
        public Guid BoardId { get; set; }
        public string Name { get; set; } = string.Empty;
        public double OrderIndex { get; set; }
    }

    public class UpdatePositionRequest
    {
        public string Name { get; set; } = string.Empty;
        public double OrderIndex { get; set; }
    }
}