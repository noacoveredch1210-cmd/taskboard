using System.ComponentModel.DataAnnotations;

namespace TaskBoard.Server.Models
{
    public class CreateCategoryRequest
    {
        public Guid Id { get; set; }
        /// <summary>コントローラーがトークンのユーザー ID で上書きするため、body の値は使われない。</summary>
        public Guid UserId { get; set; }
        [MaxLength(TextLimits.CategoryName)]
        public string Name { get; set; } = string.Empty;
        [RegularExpression(TextLimits.HexColorPattern, ErrorMessage = "色は #rrggbb 形式で指定してください。")]
        public string Color { get; set; } = string.Empty;
    }

    public class UpdateCategoryRequest
    {
        [MaxLength(TextLimits.CategoryName)]
        public string Name { get; set; } = string.Empty;
        [RegularExpression(TextLimits.HexColorPattern, ErrorMessage = "色は #rrggbb 形式で指定してください。")]
        public string Color { get; set; } = string.Empty;
    }
}
