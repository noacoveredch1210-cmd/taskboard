namespace TaskBoard.Server.Models
{
    public class CreateCategoryRequest
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Color { get; set; } = string.Empty;
    }

    public class UpdateCategoryRequest
    {
        public string Name { get; set; } = string.Empty;
        public string Color { get; set; } = string.Empty;
    }
}