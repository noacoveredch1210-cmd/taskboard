using System.ComponentModel.DataAnnotations;
using TaskBoard.Server.Models;

namespace TaskBoard.Server.Tests.Models
{
    /// <summary>
    /// リクエストモデルの検証属性が効いていることを確認する。
    /// [ApiController] が付いているため、ここで無効と判定される入力は 400 になる。
    /// </summary>
    public class RequestValidationTests
    {
        /// <summary>指定したプロパティに検証エラーが出たかどうか。</summary>
        private static bool HasErrorOn(object request, string propertyName)
        {
            var results = new List<ValidationResult>();
            Validator.TryValidateObject(request, new ValidationContext(request), results, validateAllProperties: true);
            return results.Any(r => r.MemberNames.Contains(propertyName));
        }

        private static string Text(int length) => new('あ', length);

        [Theory]
        [InlineData(TextLimits.BoardTitle, false)]
        [InlineData(TextLimits.BoardTitle + 1, true)]
        public void BoardTitle_IsRejected_WhenTooLong(int length, bool expectError)
        {
            var request = new CreateBoardRequest { Title = Text(length) };

            Assert.Equal(expectError, HasErrorOn(request, nameof(request.Title)));
        }

        [Theory]
        [InlineData(TextLimits.BoardShortName, false)]
        [InlineData(TextLimits.BoardShortName + 1, true)]
        public void BoardShortName_IsRejected_WhenTooLong(int length, bool expectError)
        {
            var request = new UpdateBoardRequest { ShortName = Text(length) };

            Assert.Equal(expectError, HasErrorOn(request, nameof(request.ShortName)));
        }

        [Theory]
        [InlineData(TextLimits.PositionName, false)]
        [InlineData(TextLimits.PositionName + 1, true)]
        public void PositionName_IsRejected_WhenTooLong(int length, bool expectError)
        {
            var request = new CreatePositionRequest { Name = Text(length) };

            Assert.Equal(expectError, HasErrorOn(request, nameof(request.Name)));
        }

        [Theory]
        [InlineData(TextLimits.CategoryName, false)]
        [InlineData(TextLimits.CategoryName + 1, true)]
        public void CategoryName_IsRejected_WhenTooLong(int length, bool expectError)
        {
            var request = new CreateCategoryRequest { Name = Text(length), Color = "#349d36" };

            Assert.Equal(expectError, HasErrorOn(request, nameof(request.Name)));
        }

        [Theory]
        [InlineData("#349d36", false)]
        [InlineData("#ABCDEF", false)]
        [InlineData("#abc", true)]        // 3 桁短縮形は input type=color が返さない
        [InlineData("#12345", true)]
        [InlineData("#1234567", true)]
        [InlineData("red", true)]
        [InlineData("349d36", true)]      // # 抜け
        [InlineData("#ggghhh", true)]     // 16 進数以外
        public void CategoryColor_MustBeHexTriplet(string color, bool expectError)
        {
            var request = new UpdateCategoryRequest { Name = "Work", Color = color };

            Assert.Equal(expectError, HasErrorOn(request, nameof(request.Color)));
        }

        [Theory]
        [InlineData(TextLimits.TaskName, false)]
        [InlineData(TextLimits.TaskName + 1, true)]
        public void TaskName_IsRejected_WhenTooLong(int length, bool expectError)
        {
            var request = new CreateTaskRequest { Name = Text(length) };

            Assert.Equal(expectError, HasErrorOn(request, nameof(request.Name)));
        }

        [Theory]
        [InlineData(TextLimits.TaskComment, false)]
        [InlineData(TextLimits.TaskComment + 1, true)]
        public void TaskComment_IsRejected_WhenTooLong(int length, bool expectError)
        {
            var request = new UpdateTaskRequest { Name = "task", Comment = Text(length) };

            Assert.Equal(expectError, HasErrorOn(request, nameof(request.Comment)));
        }

        [Fact]
        public void TaskComment_IsOptional()
        {
            var request = new UpdateTaskRequest { Name = "task", Comment = null };

            Assert.False(HasErrorOn(request, nameof(request.Comment)));
        }

        [Theory]
        [InlineData(0, false)]
        [InlineData(3, false)]
        [InlineData(-1, true)]
        [InlineData(4, true)]
        public void TaskImportance_MustBeWithinRange(int importance, bool expectError)
        {
            var request = new CreateTaskRequest { Name = "task", Importance = importance };

            Assert.Equal(expectError, HasErrorOn(request, nameof(request.Importance)));
        }

        [Fact]
        public void TaskImportance_IsOptional()
        {
            var request = new CreateTaskRequest { Name = "task", Importance = null };

            Assert.False(HasErrorOn(request, nameof(request.Importance)));
        }

        [Theory]
        [InlineData("taro@example.com", false)]
        [InlineData("not-an-email", true)]
        public void UserEmail_MustLookLikeAnEmailAddress(string email, bool expectError)
        {
            var request = new UpdateUserRequest { Name = "taro", Email = email };

            Assert.Equal(expectError, HasErrorOn(request, nameof(request.Email)));
        }
    }
}
