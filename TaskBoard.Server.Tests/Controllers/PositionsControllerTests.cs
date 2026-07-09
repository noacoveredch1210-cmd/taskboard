using Microsoft.AspNetCore.Mvc;
using NSubstitute;
using TaskBoard.Server.Controllers;
using TaskBoard.Server.Data;
using TaskBoard.Server.Models;
using TaskBoard.Server.Tests.Support;

namespace TaskBoard.Server.Tests.Controllers
{
    public class PositionsControllerTests
    {
        private readonly IPositionRepository _repository = Substitute.For<IPositionRepository>();
        private readonly Guid _userId = Guid.NewGuid();

        private PositionsController CreateController() =>
            new PositionsController(_repository).WithUser(_userId);

        [Fact]
        public async Task GetByBoard_ReturnsPositionsOfRequestedBoard()
        {
            var boardId = Guid.NewGuid();
            var positions = new[] { new Position { Id = Guid.NewGuid(), BoardId = boardId } };
            _repository.GetByBoardIdAsync(boardId, _userId).Returns(positions);

            var result = await CreateController().GetByBoard(boardId);

            var ok = Assert.IsType<OkObjectResult>(result);
            Assert.Same(positions, ok.Value);
        }

        [Fact]
        public async Task GetByBoard_ScopesLookupToAuthenticatedUser()
        {
            var boardId = Guid.NewGuid();

            await CreateController().GetByBoard(boardId);

            await _repository.Received(1).GetByBoardIdAsync(boardId, _userId);
        }

        [Fact]
        public async Task GetById_ReturnsPosition_WhenOwnedByAuthenticatedUser()
        {
            var id = Guid.NewGuid();
            var position = new Position { Id = id };
            _repository.GetByIdAsync(id, _userId).Returns(position);

            var result = await CreateController().GetById(id);

            var ok = Assert.IsType<OkObjectResult>(result);
            Assert.Same(position, ok.Value);
        }

        [Fact]
        public async Task GetById_ReturnsNotFound_WhenMissingOrNotOwned()
        {
            _repository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<Guid>()).Returns((Position?)null);

            var result = await CreateController().GetById(Guid.NewGuid());

            Assert.IsType<NotFoundResult>(result);
        }

        [Fact]
        public async Task Create_PersistsRequestAndReturnsCreatedAtAction()
        {
            var request = new CreatePositionRequest
            {
                Id = Guid.NewGuid(),
                BoardId = Guid.NewGuid(),
                Name = "TODO",
                OrderIndex = 0,
            };
            var created = new Position { Id = request.Id, BoardId = request.BoardId };
            _repository.CreateAsync(request, _userId).Returns(true);
            _repository.GetByIdAsync(request.Id, _userId).Returns(created);

            var result = await CreateController().Create(request);

            await _repository.Received(1).CreateAsync(request, _userId);
            var createdAt = Assert.IsType<CreatedAtActionResult>(result);
            Assert.Equal(nameof(PositionsController.GetById), createdAt.ActionName);
            Assert.Equal(request.Id, createdAt.RouteValues!["id"]);
            Assert.Same(created, createdAt.Value);
        }

        [Fact]
        public async Task Create_ReturnsNotFound_WhenBoardIsNotOwned()
        {
            var request = new CreatePositionRequest { Id = Guid.NewGuid(), BoardId = Guid.NewGuid() };
            _repository.CreateAsync(request, _userId).Returns(false);

            var result = await CreateController().Create(request);

            Assert.IsType<NotFoundResult>(result);
            await _repository.DidNotReceive().GetByIdAsync(Arg.Any<Guid>(), Arg.Any<Guid>());
        }

        [Fact]
        public async Task Update_ScopesWriteToAuthenticatedUser()
        {
            var id = Guid.NewGuid();
            var request = new UpdatePositionRequest { Name = "Doing", OrderIndex = 1 };
            _repository.UpdateAsync(id, _userId, request).Returns(true);

            var result = await CreateController().Update(id, request);

            Assert.IsType<NoContentResult>(result);
            await _repository.Received(1).UpdateAsync(id, _userId, request);
        }

        [Fact]
        public async Task Update_ReturnsNotFound_WhenMissingOrNotOwned()
        {
            _repository.UpdateAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<UpdatePositionRequest>()).Returns(false);

            var result = await CreateController().Update(Guid.NewGuid(), new UpdatePositionRequest());

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
