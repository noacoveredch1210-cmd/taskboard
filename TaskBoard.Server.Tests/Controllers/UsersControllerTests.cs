using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;
using TaskBoard.Server.Controllers;
using TaskBoard.Server.Data;
using TaskBoard.Server.Models;
using TaskBoard.Server.Tests.Support;

namespace TaskBoard.Server.Tests.Controllers
{
    public class UsersControllerTests
    {
        private readonly IUserRepository _repository = Substitute.For<IUserRepository>();
        private readonly Guid _userId = Guid.NewGuid();

        private UsersController CreateController(params Claim[] extraClaims) =>
            new UsersController(_repository).WithUser(_userId, extraClaims);

        private static Claim Email(string email) => new("email", email);

        private static Claim Metadata(string json) => new("user_metadata", json);

        [Fact]
        public async Task GetMe_UsesFullNameFromUserMetadata()
        {
            var controller = CreateController(
                Email("taro@example.com"),
                Metadata("""{"full_name":"山田 太郎","name":"taro"}"""));

            await controller.GetMe();

            await _repository.Received(1).EnsureAsync(_userId, "山田 太郎", "taro@example.com");
        }

        [Fact]
        public async Task GetMe_FallsBackToNameKey_WhenFullNameIsAbsent()
        {
            var controller = CreateController(
                Email("taro@example.com"),
                Metadata("""{"name":"taro"}"""));

            await controller.GetMe();

            await _repository.Received(1).EnsureAsync(_userId, "taro", "taro@example.com");
        }

        [Fact]
        public async Task GetMe_FallsBackToEmail_WhenMetadataClaimIsAbsent()
        {
            var controller = CreateController(Email("taro@example.com"));

            await controller.GetMe();

            await _repository.Received(1).EnsureAsync(_userId, "taro@example.com", "taro@example.com");
        }

        [Theory]
        [InlineData("not json")]
        [InlineData("""{"full_name":""" )]
        [InlineData("[]")] // オブジェクト以外でも例外にせず表示名なしとして扱う
        public async Task GetMe_FallsBackToEmail_WhenMetadataIsNotAUsableObject(string metadata)
        {
            var controller = CreateController(Email("taro@example.com"), Metadata(metadata));

            await controller.GetMe();

            await _repository.Received(1).EnsureAsync(_userId, "taro@example.com", "taro@example.com");
        }

        [Theory]
        [InlineData("""{"full_name":"   ","name":"taro"}""")] // 空白のみの full_name は無視して name を使う
        [InlineData("""{"full_name":null,"name":"taro"}""")]
        [InlineData("""{"full_name":123,"name":"taro"}""")]
        public async Task GetMe_SkipsUnusableFullName(string metadata)
        {
            var controller = CreateController(Email("taro@example.com"), Metadata(metadata));

            await controller.GetMe();

            await _repository.Received(1).EnsureAsync(_userId, "taro", "taro@example.com");
        }

        [Fact]
        public async Task GetMe_UsesEmptyEmail_WhenEmailClaimIsAbsent()
        {
            var controller = CreateController();

            await controller.GetMe();

            await _repository.Received(1).EnsureAsync(_userId, string.Empty, string.Empty);
        }

        [Fact]
        public async Task GetMe_ReturnsUserReadBackAfterEnsure()
        {
            var user = new User { Id = _userId, Name = "taro", Email = "taro@example.com" };
            _repository.GetByIdAsync(_userId).Returns(user);

            var result = await CreateController(Email("taro@example.com")).GetMe();

            var ok = Assert.IsType<OkObjectResult>(result);
            Assert.Same(user, ok.Value);
        }

        [Fact]
        public async Task UpdateMe_UpdatesAuthenticatedUserOnly()
        {
            var request = new UpdateUserRequest { Name = "renamed", Email = "new@example.com" };
            _repository.UpdateAsync(_userId, request).Returns(true);

            var result = await CreateController().UpdateMe(request);

            Assert.IsType<NoContentResult>(result);
            await _repository.Received(1).UpdateAsync(_userId, request);
        }

        [Fact]
        public async Task UpdateMe_ReturnsNotFound_WhenNoRowAffected()
        {
            _repository.UpdateAsync(Arg.Any<Guid>(), Arg.Any<UpdateUserRequest>()).Returns(false);

            var result = await CreateController().UpdateMe(new UpdateUserRequest());

            Assert.IsType<NotFoundResult>(result);
        }

        [Fact]
        public async Task DeleteMe_DeletesAuthenticatedUserOnly()
        {
            _repository.DeleteAsync(_userId).Returns(true);

            var result = await CreateController().DeleteMe();

            Assert.IsType<NoContentResult>(result);
            await _repository.Received(1).DeleteAsync(_userId);
        }

        [Fact]
        public async Task DeleteMe_ReturnsNoContent_EvenWhenAlreadyGone()
        {
            // 冪等：行が無くても最終状態は同じなので 204。
            _repository.DeleteAsync(Arg.Any<Guid>()).Returns(false);

            var result = await CreateController().DeleteMe();

            Assert.IsType<NoContentResult>(result);
        }
    }
}
