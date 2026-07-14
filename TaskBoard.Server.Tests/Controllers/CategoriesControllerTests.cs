using Microsoft.AspNetCore.Mvc;
using NSubstitute;
using TaskBoard.Server.Controllers;
using TaskBoard.Server.Data;
using TaskBoard.Server.Models;
using TaskBoard.Server.Tests.Support;

namespace TaskBoard.Server.Tests.Controllers
{
    public class CategoriesControllerTests
    {
        private readonly ICategoryRepository _repository = Substitute.For<ICategoryRepository>();
        private readonly Guid _userId = Guid.NewGuid();
        private readonly Guid _boardId = Guid.NewGuid();

        private CategoriesController CreateController() =>
            new CategoriesController(_repository).WithUser(_userId);

        [Fact]
        public async Task GetByBoard_ReturnsCategoriesForMember()
        {
            var categories = new[] { new Category { Id = Guid.NewGuid(), BoardId = _boardId } };
            _repository.GetByBoardIdAsync(_boardId, _userId).Returns(categories);

            var result = await CreateController().GetByBoard(_boardId);

            var ok = Assert.IsType<OkObjectResult>(result);
            Assert.Same(categories, ok.Value);
        }

        [Fact]
        public async Task GetByBoard_ScopesLookupToAuthenticatedUser()
        {
            _repository.GetByBoardIdAsync(Arg.Any<Guid>(), Arg.Any<Guid>()).Returns([]);

            await CreateController().GetByBoard(_boardId);

            // 参加していない board のカテゴリーを引けないよう、ユーザー ID 付きで問い合わせる。
            await _repository.Received(1).GetByBoardIdAsync(_boardId, _userId);
        }

        [Fact]
        public async Task GetById_ReturnsCategory_WhenMember()
        {
            var id = Guid.NewGuid();
            var category = new Category { Id = id, BoardId = _boardId };
            _repository.GetByIdAsync(id, _userId).Returns(category);

            var result = await CreateController().GetById(id);

            var ok = Assert.IsType<OkObjectResult>(result);
            Assert.Same(category, ok.Value);
        }

        [Fact]
        public async Task GetById_ReturnsNotFound_WhenMissingOrNotMember()
        {
            _repository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<Guid>()).Returns((Category?)null);

            var result = await CreateController().GetById(Guid.NewGuid());

            Assert.IsType<NotFoundResult>(result);
        }

        [Fact]
        public async Task Create_PassesTokenUserToRepository()
        {
            var request = new CreateCategoryRequest
            {
                Id = Guid.NewGuid(),
                BoardId = _boardId,
                Name = "Work",
                Color = "#ff0000",
            };
            _repository.CreateAsync(request, _userId).Returns(true);

            await CreateController().Create(request);

            // 作成はトークンのユーザーとして行う（board メンバー判定は認証ユーザーで）。
            await _repository.Received(1).CreateAsync(request, _userId);
        }

        [Fact]
        public async Task Create_ReturnsNotFound_WhenNotBoardMember()
        {
            _repository.CreateAsync(Arg.Any<CreateCategoryRequest>(), Arg.Any<Guid>()).Returns(false);

            var result = await CreateController().Create(
                new CreateCategoryRequest { Id = Guid.NewGuid(), BoardId = _boardId });

            Assert.IsType<NotFoundResult>(result);
        }

        [Fact]
        public async Task Create_ReturnsCreatedAtActionWithPersistedCategory()
        {
            var request = new CreateCategoryRequest
            { Id = Guid.NewGuid(), BoardId = _boardId, Name = "Work", Color = "#ff0000" };
            _repository.CreateAsync(request, _userId).Returns(true);
            var created = new Category { Id = request.Id, BoardId = _boardId };
            _repository.GetByIdAsync(request.Id, _userId).Returns(created);

            var result = await CreateController().Create(request);

            var createdAt = Assert.IsType<CreatedAtActionResult>(result);
            Assert.Equal(nameof(CategoriesController.GetById), createdAt.ActionName);
            Assert.Equal(request.Id, createdAt.RouteValues!["id"]);
            Assert.Same(created, createdAt.Value);
        }

        [Fact]
        public async Task Update_ScopesWriteToAuthenticatedUser()
        {
            var id = Guid.NewGuid();
            var request = new UpdateCategoryRequest { Name = "Renamed", Color = "#00ff00" };
            _repository.UpdateAsync(id, _userId, request).Returns(true);

            var result = await CreateController().Update(id, request);

            Assert.IsType<NoContentResult>(result);
            await _repository.Received(1).UpdateAsync(id, _userId, request);
        }

        [Fact]
        public async Task Update_ReturnsNotFound_WhenMissingOrNotMember()
        {
            _repository.UpdateAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<UpdateCategoryRequest>()).Returns(false);

            var result = await CreateController().Update(Guid.NewGuid(), new UpdateCategoryRequest());

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
        public async Task Delete_ReturnsNotFound_WhenMissingOrNotMember()
        {
            _repository.DeleteAsync(Arg.Any<Guid>(), Arg.Any<Guid>()).Returns(false);

            var result = await CreateController().Delete(Guid.NewGuid());

            Assert.IsType<NotFoundResult>(result);
        }
    }
}
