using System.ComponentModel.DataAnnotations;

namespace TaskBoard.Server.Models
{
    public class UpdateUserRequest
    {
        [MaxLength(TextLimits.UserName)]
        public string Name { get; set; } = string.Empty;
        [EmailAddress]
        [MaxLength(TextLimits.UserEmail)]
        public string Email { get; set; } = string.Empty;
    }
}
