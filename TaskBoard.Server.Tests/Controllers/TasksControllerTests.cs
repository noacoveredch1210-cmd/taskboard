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
        private readonly Guid _userId = Guid.NewGuid();

        private TasksController CreateController() =>
            new TasksController(_repository).WithUser(_userId);

        [Fact]
        public async Task GetByBoard_ReturnsTasksOfRequestedBoard()
        {
            var boardId = Guid.NewGuid();
            var tasks = new[] { new TaskItem { Id = Guid.NewGuid(), BoardId = boardId } };
            _repository.GetByBoardIdAsync(boardId, _userId).Returns(tasks);

            var result = await CreateController().GetByBoard(boardId);

            var ok = Assert.IsType<OkObjectResult>(result);
            Assert.Same(tasks, ok.Value);
        }

        [Fact]
        public async Task GetByBoard_ScopesLookupToAuthenticatedUser()
        {
            var boardId = Guid.NewGuid();

            await CreateController().GetByBoard(boardId);

            // 他人の board の boardId を渡されても、所有者 ID 付きで問い合わせる。
            await _repository.Received(1).GetByBoardIdAsync(boardId, _userId);
        }

        [Fact]
        public async Task GetById_ReturnsTask_WhenOwnedByAuthenticatedUser()
        {
            var id = Guid.NewGuid();
            var task = new TaskItem { Id = id };
            _repository.GetByIdAsync(id, _userId).Returns(task);

            var result = await CreateController().GetById(id);

            var ok = Assert.IsType<OkObjectResult>(result);
            Assert.Same(task, ok.Value);
        }

        [Fact]
        public async Task GetById_ReturnsNotFound_WhenMissingOrNotOwned()
        {
            _repository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<Guid>()).Returns((TaskItem?)null);

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
            _repository.CreateAsync(request, _userId).Returns(true);
            _repository.GetByIdAsync(request.Id, _userId).Returns(created);

            var result = await CreateController().Create(request);

            await _repository.Received(1).CreateAsync(request, _userId);
            var createdAt = Assert.IsType<CreatedAtActionResult>(result);
            Assert.Equal(nameof(TasksController.GetById), createdAt.ActionName);
            Assert.Equal(request.Id, createdAt.RouteValues!["id"]);
            Assert.Same(created, createdAt.Value);
        }

        [Fact]
        public async Task Create_ReturnsNotFound_WhenBoardIsNotOwnedOrAssignmentIsInvalid()
        {
            var request = new CreateTaskRequest { Id = Guid.NewGuid(), BoardId = Guid.NewGuid() };
            _repository.CreateAsync(request, _userId).Returns(false);

            var result = await CreateController().Create(request);

            Assert.IsType<NotFoundResult>(result);
            // 作成に失敗した以上、読み戻しも行わない。
            await _repository.DidNotReceive().GetByIdAsync(Arg.Any<Guid>(), Arg.Any<Guid>());
        }

        [Fact]
        public async Task Update_ScopesWriteToAuthenticatedUser()
        {
            var id = Guid.NewGuid();
            var request = new UpdateTaskRequest { Name = "Renamed", OrderIndex = 2 };
            _repository.UpdateAsync(id, _userId, request).Returns(true);

            var result = await CreateController().Update(id, request);

            Assert.IsType<NoContentResult>(result);
            await _repository.Received(1).UpdateAsync(id, _userId, request);
        }

        [Fact]
        public async Task Update_ReturnsNotFound_WhenMissingOrNotOwned()
        {
            _repository.UpdateAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<UpdateTaskRequest>()).Returns(false);

            var result = await CreateController().Update(Guid.NewGuid(), new UpdateTaskRequest());

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

        [Fact]
        public async Task GetTrash_ScopesLookupToAuthenticatedUser()
        {
            var boardId = Guid.NewGuid();
            var trash = new[] { new TaskItem { Id = Guid.NewGuid(), BoardId = boardId } };
            _repository.GetTrashByBoardIdAsync(boardId, _userId).Returns(trash);

            var result = await CreateController().GetTrash(boardId);

            var ok = Assert.IsType<OkObjectResult>(result);
            Assert.Same(trash, ok.Value);
            await _repository.Received(1).GetTrashByBoardIdAsync(boardId, _userId);
        }

        [Fact]
        public async Task Restore_ScopesToAuthenticatedUser()
        {
            var id = Guid.NewGuid();
            _repository.RestoreAsync(id, _userId).Returns(true);

            var result = await CreateController().Restore(id);

            Assert.IsType<NoContentResult>(result);
            await _repository.Received(1).RestoreAsync(id, _userId);
        }

        [Fact]
        public async Task Restore_ReturnsNotFound_WhenNotPermitted()
        {
            _repository.RestoreAsync(Arg.Any<Guid>(), Arg.Any<Guid>()).Returns(false);

            var result = await CreateController().Restore(Guid.NewGuid());

            Assert.IsType<NotFoundResult>(result);
        }

        [Fact]
        public async Task Purge_ReturnsNotFound_WhenNotPermitted()
        {
            _repository.PurgeAsync(Arg.Any<Guid>(), Arg.Any<Guid>()).Returns(false);

            var result = await CreateController().Purge(Guid.NewGuid());

            Assert.IsType<NotFoundResult>(result);
        }

        [Fact]
        public async Task PurgeAll_ScopesToAuthenticatedUser()
        {
            var boardId = Guid.NewGuid();
            _repository.PurgeAllAsync(boardId, _userId).Returns(true);

            var result = await CreateController().PurgeAll(boardId);

            Assert.IsType<NoContentResult>(result);
            await _repository.Received(1).PurgeAllAsync(boardId, _userId);
        }

        [Fact]
        public async Task PurgeAll_ReturnsNotFound_WhenNotOwner()
        {
            _repository.PurgeAllAsync(Arg.Any<Guid>(), Arg.Any<Guid>()).Returns(false);

            var result = await CreateController().PurgeAll(Guid.NewGuid());

            Assert.IsType<NotFoundResult>(result);
        }
    }
}
