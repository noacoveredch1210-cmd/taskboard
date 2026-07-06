namespace TaskBoard.Server.Models
{
    public class CreateBoardRequest
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public string ShortName { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
    }

    public class UpdateBoardRequest
    {
        public string ShortName { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
    }
}