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

        private CategoriesController CreateController() =>
            new CategoriesController(_repository).WithUser(_userId);

        [Fact]
        public async Task GetMine_ReturnsCategoriesOfAuthenticatedUser()
        {
            var categories = new[] { new Category { Id = Guid.NewGuid(), UserId = _userId } };
            _repository.GetByUserIdAsync(_userId).Returns(categories);

            var result = await CreateController().GetMine();

            var ok = Assert.IsType<OkObjectResult>(result);
            Assert.Same(categories, ok.Value);
        }

        [Fact]
        public async Task GetMine_DoesNotLeakOtherUsersCategories()
        {
            _repository.GetByUserIdAsync(Arg.Any<Guid>()).Returns([]);

            await CreateController().GetMine();

            await _repository.Received(1).GetByUserIdAsync(_userId);
        }

        [Fact]
        public async Task GetById_ReturnsCategory_WhenOwnedByAuthenticatedUser()
        {
            var id = Guid.NewGuid();
            var category = new Category { Id = id, UserId = _userId };
            _repository.GetByIdAsync(id, _userId).Returns(category);

            var result = await CreateController().GetById(id);

            var ok = Assert.IsType<OkObjectResult>(result);
            Assert.Same(category, ok.Value);
        }

        [Fact]
        public async Task GetById_ScopesLookupToAuthenticatedUser()
        {
            var id = Guid.NewGuid();

            await CreateController().GetById(id);

            await _repository.Received(1).GetByIdAsync(id, _userId);
        }

        [Fact]
        public async Task GetById_ReturnsNotFound_WhenMissingOrNotOwned()
        {
            _repository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<Guid>()).Returns((Category?)null);

            var result = await CreateController().GetById(Guid.NewGuid());

            Assert.IsType<NotFoundResult>(result);
        }

        [Fact]
        public async Task Create_OverwritesUserIdWithTokenUser()
        {
            var request = new CreateCategoryRequest
            {
                Id = Guid.NewGuid(),
                UserId = Guid.NewGuid(),
                Name = "Work",
                Color = "#ff0000",
            };

            await CreateController().Create(request);

            await _repository.Received(1).CreateAsync(Arg.Is<CreateCategoryRequest>(r => r.UserId == _userId));
        }

        [Fact]
        public async Task Create_ReturnsCreatedAtActionWithPersistedCategory()
        {
            var request = new CreateCategoryRequest { Id = Guid.NewGuid(), Name = "Work", Color = "#ff0000" };
            var created = new Category { Id = request.Id, UserId = _userId };
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
        public async Task Update_ReturnsNotFound_WhenMissingOrNotOwned()
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
        public async Task Delete_ReturnsNotFound_WhenMissingOrNotOwned()
        {
            _repository.DeleteAsync(Arg.Any<Guid>(), Arg.Any<Guid>()).Returns(false);

            var result = await CreateController().Delete(Guid.NewGuid());

            Assert.IsType<NotFoundResult>(result);
        }
    }
}
