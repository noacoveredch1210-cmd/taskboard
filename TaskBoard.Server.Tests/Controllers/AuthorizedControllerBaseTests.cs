using System.Security.Claims;
using TaskBoard.Server.Controllers;
using TaskBoard.Server.Tests.Support;

namespace TaskBoard.Server.Tests.Controllers
{
    public class AuthorizedControllerBaseTests
    {
        /// <summary>protected な CurrentUserId をテストから観測するための最小の派生クラス。</summary>
        private sealed class TestController : AuthorizedControllerBase
        {
            public Guid Expose() => CurrentUserId;
        }

        [Fact]
        public void CurrentUserId_ReturnsSubClaim()
        {
            var userId = Guid.NewGuid();
            var controller = new TestController().WithUser(userId);

            Assert.Equal(userId, controller.Expose());
        }

        [Fact]
        public void CurrentUserId_Throws_WhenSubClaimIsMissing()
        {
            var controller = new TestController().WithClaims(new Claim("email", "a@example.com"));

            Assert.Throws<InvalidOperationException>(() => controller.Expose());
        }

        [Theory]
        [InlineData("")]
        [InlineData("not-a-guid")]
        [InlineData("12345")]
        public void CurrentUserId_Throws_WhenSubClaimIsNotAGuid(string sub)
        {
            var controller = new TestController().WithClaims(new Claim("sub", sub));

            Assert.Throws<InvalidOperationException>(() => controller.Expose());
        }
    }
}
