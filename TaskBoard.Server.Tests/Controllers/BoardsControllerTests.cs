using Microsoft.AspNetCore.Mvc;
using NSubstitute;
using TaskBoard.Server.Controllers;
using TaskBoard.Server.Data;
using TaskBoard.Server.Models;
using TaskBoard.Server.Tests.Support;

namespace TaskBoard.Server.Tests.Controllers
{
    public class BoardsControllerTests
    {
        private readonly IBoardRepository _repository = Substitute.For<IBoardRepository>();
        private readonly Guid _userId = Guid.NewGuid();

        private BoardsController CreateController() =>
            new BoardsController(_repository).WithUser(_userId);

        [Fact]
        public async Task GetMine_ReturnsBoardsOfAuthenticatedUser()
        {
            var boards = new[] { new Board { Id = Guid.NewGuid(), UserId = _userId } };
            _repository.GetByUserIdAsync(_userId).Returns(boards);

            var result = await CreateController().GetMine();

            var ok = Assert.IsType<OkObjectResult>(result);
            Assert.Same(boards, ok.Value);
        }

        [Fact]
        public async Task GetMine_DoesNotLeakOtherUsersBoards()
        {
            _repository.GetByUserIdAsync(Arg.Any<Guid>()).Returns([]);

            await CreateController().GetMine();

            // 一覧取得は必ずトークンのユーザー ID で問い合わせる。
            await _repository.Received(1).GetByUserIdAsync(_userId);
        }

        [Fact]
        public async Task GetById_ReturnsBoard_WhenOwnedByAuthenticatedUser()
        {
            var id = Guid.NewGuid();
            var board = new Board { Id = id, UserId = _userId };
            _repository.GetByIdAsync(id, _userId).Returns(board);

            var result = await CreateController().GetById(id);

            var ok = Assert.IsType<OkObjectResult>(result);
            Assert.Same(board, ok.Value);
        }

        [Fact]
        public async Task GetById_ScopesLookupToAuthenticatedUser()
        {
            var id = Guid.NewGuid();

            await CreateController().GetById(id);

            // 他人の board を引けないよう、所有者 ID 付きで問い合わせる。
            await _repository.Received(1).GetByIdAsync(id, _userId);
        }

        [Fact]
        public async Task GetById_ReturnsNotFound_WhenMissingOrNotOwned()
        {
            _repository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<Guid>()).Returns((Board?)null);

            var result = await CreateController().GetById(Guid.NewGuid());

            Assert.IsType<NotFoundResult>(result);
        }

        [Fact]
        public async Task Create_OverwritesUserIdWithTokenUser()
        {
            // 攻撃者が body で他人の userId を指定しても、トークンのユーザーに矯正される。
            var request = new CreateBoardRequest
            {
                Id = Guid.NewGuid(),
                UserId = Guid.NewGuid(),
                ShortName = "TB",
                Title = "TaskBoard",
            };

            await CreateController().Create(request);

            await _repository.Received(1).CreateAsync(Arg.Is<CreateBoardRequest>(r => r.UserId == _userId));
        }

        [Fact]
        public async Task Create_ReturnsCreatedAtActionWithPersistedBoard()
        {
            var request = new CreateBoardRequest { Id = Guid.NewGuid(), ShortName = "TB", Title = "TaskBoard" };
            var created = new Board { Id = request.Id, UserId = _userId };
            _repository.GetByIdAsync(request.Id, _userId).Returns(created);

            var result = await CreateController().Create(request);

            var createdAt = Assert.IsType<CreatedAtActionResult>(result);
            Assert.Equal(nameof(BoardsController.GetById), createdAt.ActionName);
            Assert.Equal(request.Id, createdAt.RouteValues!["id"]);
            Assert.Same(created, createdAt.Value);
        }

        [Fact]
        public async Task Update_ScopesWriteToAuthenticatedUser()
        {
            var id = Guid.NewGuid();
            var request = new UpdateBoardRequest { ShortName = "TB", Title = "Renamed" };
            _repository.UpdateAsync(id, _userId, request).Returns(true);

            var result = await CreateController().Update(id, request);

            Assert.IsType<NoContentResult>(result);
            await _repository.Received(1).UpdateAsync(id, _userId, request);
        }

        [Fact]
        public async Task Update_ReturnsNotFound_WhenMissingOrNotOwned()
        {
            _repository.UpdateAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<UpdateBoardRequest>()).Returns(false);

            var result = await CreateController().Update(Guid.NewGuid(), new UpdateBoardRequest());

            Assert.IsType<NotFoundResult>(result);
        }

        [Fact]
        public async Task Delete_ScopesDeleteToAuthenticatedUser()
        {
            var id = Guid.NewGuid();
            _repository.DeleteAsync(id, _userId).Returns(true);

            var result = await CreateController().Delete(id);

            Assert.IsType<NoContentResult>(result);
            await _repository.Received(1).DeleteAsync(id, _userId);
        }

        [Fact]
        public async Task Delete_ReturnsNotFound_WhenMissingOrNotOwned()
        {
            _repository.DeleteAsync(Arg.Any<Guid>(), Arg.Any<Guid>()).Returns(false);

            var result = await CreateController().Delete(Guid.NewGuid());

            Assert.IsType<NotFoundResult>(result);
        }
    }
}
