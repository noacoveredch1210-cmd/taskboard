using Microsoft.AspNetCore.Mvc;
using NSubstitute;
using TaskBoard.Server.Controllers;
using TaskBoard.Server.Data;
using TaskBoard.Server.Models;
using TaskBoard.Server.Tests.Support;

namespace TaskBoard.Server.Tests.Controllers
{
    public class TasksControllerTests
    {
        private readonly ITaskRepository _repository = Substitute.For<ITaskRepository>();

        private TasksController CreateController() =>
            new TasksController(_repository).WithUser(Guid.NewGuid());

        [Fact]
        public async Task GetByBoard_ReturnsTasksOfRequestedBoard()
        {
            var boardId = Guid.NewGuid();
            var tasks = new[] { new TaskItem { Id = Guid.NewGuid(), BoardId = boardId } };
            _repository.GetByBoardIdAsync(boardId).Returns(tasks);

            var result = await CreateController().GetByBoard(boardId);

            var ok = Assert.IsType<OkObjectResult>(result);
            Assert.Same(tasks, ok.Value);
        }

        [Fact]
        public async Task GetById_ReturnsTask_WhenFound()
        {
            var id = Guid.NewGuid();
            var task = new TaskItem { Id = id };
            _repository.GetByIdAsync(id).Returns(task);

            var result = await CreateController().GetById(id);

            var ok = Assert.IsType<OkObjectResult>(result);
            Assert.Same(task, ok.Value);
        }

        [Fact]
        public async Task GetById_ReturnsNotFound_WhenMissing()
        {
            _repository.GetByIdAsync(Arg.Any<Guid>()).Returns((TaskItem?)null);

            var result = await CreateController().GetById(Guid.NewGuid());

            Assert.IsType<NotFoundResult>(result);
        }

        [Fact]
        public async Task Create_PersistsRequestAndReturnsCreatedAtAction()
        {
            var request = new CreateTaskRequest
            {
                Id = Guid.NewGuid(),
                BoardId = Guid.NewGuid(),
                Name = "Write tests",
                Deadline = new DateOnly(2026, 7, 9),
                OrderIndex = 1.5,
            };
            var created = new TaskItem { Id = request.Id, BoardId = request.BoardId };
            _repository.GetByIdAsync(request.Id).Returns(created);

            var result = await CreateController().Create(request);

            await _repository.Received(1).CreateAsync(request);
            var createdAt = Assert.IsType<CreatedAtActionResult>(result);
            Assert.Equal(nameof(TasksController.GetById), createdAt.ActionName);
            Assert.Equal(request.Id, createdAt.RouteValues!["id"]);
            Assert.Same(created, createdAt.Value);
        }

        [Fact]
        public async Task Update_ReturnsNoContent_WhenRowAffected()
        {
            var id = Guid.NewGuid();
            var request = new UpdateTaskRequest { Name = "Renamed", OrderIndex = 2 };
            _repository.UpdateAsync(id, request).Returns(true);

            var result = await CreateController().Update(id, request);

            Assert.IsType<NoContentResult>(result);
        }

        [Fact]
        public async Task Update_ReturnsNotFound_WhenNoRowAffected()
        {
            _repository.UpdateAsync(Arg.Any<Guid>(), Arg.Any<UpdateTaskRequest>()).Returns(false);

            var result = await CreateController().Update(Guid.NewGuid(), new UpdateTaskRequest());

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
