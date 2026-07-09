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

        private PositionsController CreateController() =>
            new PositionsController(_repository).WithUser(Guid.NewGuid());

        [Fact]
        public async Task GetByBoard_ReturnsPositionsOfRequestedBoard()
        {
            var boardId = Guid.NewGuid();
            var positions = new[] { new Position { Id = Guid.NewGuid(), BoardId = boardId } };
            _repository.GetByBoardIdAsync(boardId).Returns(positions);

            var result = await CreateController().GetByBoard(boardId);

            var ok = Assert.IsType<OkObjectResult>(result);
            Assert.Same(positions, ok.Value);
        }

        [Fact]
        public async Task GetById_ReturnsPosition_WhenFound()
        {
            var id = Guid.NewGuid();
            var position = new Position { Id = id };
            _repository.GetByIdAsync(id).Returns(position);

            var result = await CreateController().GetById(id);

            var ok = Assert.IsType<OkObjectResult>(result);
            Assert.Same(position, ok.Value);
        }

        [Fact]
        public async Task GetById_ReturnsNotFound_WhenMissing()
        {
            _repository.GetByIdAsync(Arg.Any<Guid>()).Returns((Position?)null);

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
            _repository.GetByIdAsync(request.Id).Returns(created);

            var result = await CreateController().Create(request);

            await _repository.Received(1).CreateAsync(request);
            var createdAt = Assert.IsType<CreatedAtActionResult>(result);
            Assert.Equal(nameof(PositionsController.GetById), createdAt.ActionName);
            Assert.Equal(request.Id, createdAt.RouteValues!["id"]);
            Assert.Same(created, createdAt.Value);
        }

        [Fact]
        public async Task Update_ReturnsNoContent_WhenRowAffected()
        {
            var id = Guid.NewGuid();
            var request = new UpdatePositionRequest { Name = "Doing", OrderIndex = 1 };
            _repository.UpdateAsync(id, request).Returns(true);

            var result = await CreateController().Update(id, request);

            Assert.IsType<NoContentResult>(result);
        }

        [Fact]
        public async Task Update_ReturnsNotFound_WhenNoRowAffected()
        {
            _repository.UpdateAsync(Arg.Any<Guid>(), Arg.Any<UpdatePositionRequest>()).Returns(false);

            var result = await CreateController().Update(Guid.NewGuid(), new UpdatePositionRequest());

            Assert.IsType<NotFoundResult>(result);
        }

        [Fact]
        public async Task Delete_ReturnsNoContent_WhenRowAffected()
        {
            var id = Guid.NewGuid();
            _repository.DeleteAsync(id).Returns(true);

            var result = await CreateController().Delete(id);

            Assert.IsType<NoContentResult>(result);
        }

        [Fact]
        public async Task Delete_ReturnsNotFound_WhenNoRowAffected()
        {
            _repository.DeleteAsync(Arg.Any<Guid>()).Returns(false);

            var result = await CreateController().Delete(Guid.NewGuid());

            Assert.IsType<NotFoundResult>(result);
        }
    }
}
