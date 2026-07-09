using System.ComponentModel.DataAnnotations;

namespace TaskBoard.Server.Models
{
    public class CreateBoardRequest
    {
        public Guid Id { get; set; }
        /// <summary>コントローラーがトークンのユーザー ID で上書きするため、body の値は使われない。</summary>
        public Guid UserId { get; set; }
        [MaxLength(TextLimits.BoardShortName)]
        public string ShortName { get; set; } = string.Empty;
        [MaxLength(TextLimits.BoardTitle)]
        public string Title { get; set; } = string.Empty;
    }

    public class UpdateBoardRequest
    {
        [MaxLength(TextLimits.BoardShortName)]
        public string ShortName { get; set; } = string.Empty;
        [MaxLength(TextLimits.BoardTitle)]
        public string Title { get; set; } = string.Empty;
    }
}
