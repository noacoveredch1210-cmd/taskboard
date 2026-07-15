using System.Data;
using TaskBoard.Server.Data;
using TaskBoard.Server.IntegrationTests.Infrastructure;
using TaskBoard.Server.Models;

namespace TaskBoard.Server.IntegrationTests.Repositories
{
    /// <summary>
    /// tasks の所有権は SQL の EXISTS 述語（board 経由）で強制している。
    /// また CanAssign が、他 board の position や他人の category を紐付けさせない。
    /// これらはコントローラーのモックテストでは検証できないため、実 DB で確かめる。
    /// </summary>
    public class TaskRepositoryTests : IntegrationTestBase
    {
        private static readonly Guid Owner = Guid.NewGuid();
        private static readonly Guid Stranger = Guid.NewGuid();

        public TaskRepositoryTests(PostgresFixture fixture) : base(fixture) { }

        [SkippableFact]
        public async Task Create_は所有していないboardには作れない()
        {
            RequireDocker();
            using var connection = await Fixture.OpenConnectionAsync();
            var world = await SeedWorldAsync(connection);
            var repository = new TaskRepository(connection);

            // Stranger が Owner の board にタスクを作ろうとする。
            var created = await repository.CreateAsync(
                NewTask(Guid.NewGuid(), world.OwnerBoard, world.OwnerPosition), Stranger);

            Assert.False(created);
        }

        [SkippableFact]
        public async Task Create_は他boardのpositionを紐付けさせない()
        {
            RequireDocker();
            using var connection = await Fixture.OpenConnectionAsync();
            var world = await SeedWorldAsync(connection);
            var repository = new TaskRepository(connection);

            // Owner の board に、Stranger の board にある position を割り当てようとする。
            var request = NewTask(Guid.NewGuid(), world.OwnerBoard, world.StrangerPosition);

            Assert.False(await repository.CreateAsync(request, Owner));
        }

        [SkippableFact]
        public async Task Create_は他boardのcategoryを紐付けさせない()
        {
            RequireDocker();
            using var connection = await Fixture.OpenConnectionAsync();
            var world = await SeedWorldAsync(connection);
            var repository = new TaskRepository(connection);

            var request = NewTask(Guid.NewGuid(), world.OwnerBoard, world.OwnerPosition);
            request.CategoryId = world.StrangerCategory; // 別 board のカテゴリー

            Assert.False(await repository.CreateAsync(request, Owner));
        }

        [SkippableFact]
        public async Task Create_は正当なposition_categoryなら成功する()
        {
            RequireDocker();
            using var connection = await Fixture.OpenConnectionAsync();
            var world = await SeedWorldAsync(connection);
            var repository = new TaskRepository(connection);

            var taskId = Guid.NewGuid();
            var request = NewTask(taskId, world.OwnerBoard, world.OwnerPosition);
            request.CategoryId = world.OwnerCategory;

            Assert.True(await repository.CreateAsync(request, Owner));
            Assert.NotNull(await repository.GetByIdAsync(taskId, Owner));
        }

        [SkippableFact]
        public async Task GetByBoardId_は他人のboardのタスクを返さない()
        {
            RequireDocker();
            using var connection = await Fixture.OpenConnectionAsync();
            var world = await SeedWorldAsync(connection);
            var repository = new TaskRepository(connection);
            await repository.CreateAsync(
                NewTask(Guid.NewGuid(), world.OwnerBoard, world.OwnerPosition), Owner);

            // Stranger が Owner の board のタスク一覧を要求しても空。
            var tasks = await repository.GetByBoardIdAsync(world.OwnerBoard, Stranger);

            Assert.Empty(tasks);
        }

        [SkippableFact]
        public async Task Delete_は他人のタスクには効かない()
        {
            RequireDocker();
            using var connection = await Fixture.OpenConnectionAsync();
            var world = await SeedWorldAsync(connection);
            var repository = new TaskRepository(connection);
            var taskId = Guid.NewGuid();
            await repository.CreateAsync(
                NewTask(taskId, world.OwnerBoard, world.OwnerPosition), Owner);

            Assert.False(await repository.DeleteAsync(taskId, Stranger));
            Assert.NotNull(await repository.GetByIdAsync(taskId, Owner));

            Assert.True(await repository.DeleteAsync(taskId, Owner));
            Assert.Null(await repository.GetByIdAsync(taskId, Owner));
        }

        [SkippableFact]
        public async Task deadline_は日付として往復する()
        {
            RequireDocker();
            using var connection = await Fixture.OpenConnectionAsync();
            var world = await SeedWorldAsync(connection);
            var repository = new TaskRepository(connection);

            var taskId = Guid.NewGuid();
            var request = NewTask(taskId, world.OwnerBoard, world.OwnerPosition);
            request.Deadline = new DateOnly(2026, 7, 13);

            await repository.CreateAsync(request, Owner);
            var task = await repository.GetByIdAsync(taskId, Owner);

            // DateOnly 型ハンドラ経由で date 列と正しく往復すること。
            Assert.Equal(new DateOnly(2026, 7, 13), task!.Deadline);
        }

        [SkippableFact]
        public async Task Create_は同一boardのメンバーを担当者にできる()
        {
            RequireDocker();
            using var connection = await Fixture.OpenConnectionAsync();
            var world = await SeedWorldAsync(connection);
            var repository = new TaskRepository(connection);

            var taskId = Guid.NewGuid();
            var request = NewTask(taskId, world.OwnerBoard, world.OwnerPosition);
            request.AssigneeId = Owner; // Owner は OwnerBoard のメンバー

            Assert.True(await repository.CreateAsync(request, Owner));
            var task = await repository.GetByIdAsync(taskId, Owner);
            Assert.Equal(Owner, task!.AssigneeId);
        }

        [SkippableFact]
        public async Task Create_はメンバーでないユーザーを担当者にできない()
        {
            RequireDocker();
            using var connection = await Fixture.OpenConnectionAsync();
            var world = await SeedWorldAsync(connection);
            var repository = new TaskRepository(connection);

            var request = NewTask(Guid.NewGuid(), world.OwnerBoard, world.OwnerPosition);
            request.AssigneeId = Stranger; // Stranger は OwnerBoard のメンバーではない

            Assert.False(await repository.CreateAsync(request, Owner));
        }

        [SkippableFact]
        public async Task 担当者がboardを退出するとタスクは未担当に戻る()
        {
            RequireDocker();
            using var connection = await Fixture.OpenConnectionAsync();
            var world = await SeedWorldAsync(connection);
            var boards = new BoardRepository(connection);
            var tasks = new TaskRepository(connection);

            // Stranger を OwnerBoard のメンバーにする（承認制フロー）。
            var token = await boards.GetShareTokenAsync(world.OwnerBoard, Owner);
            await boards.RequestJoinByTokenAsync(token!.Value, Stranger);
            await boards.ApproveJoinRequestAsync(world.OwnerBoard, Owner, Stranger);

            // Stranger を担当者にしたタスクを作る。
            var taskId = Guid.NewGuid();
            var request = NewTask(taskId, world.OwnerBoard, world.OwnerPosition);
            request.AssigneeId = Stranger;
            Assert.True(await tasks.CreateAsync(request, Stranger));

            // Stranger が退出すると、その担当は外れる（未担当に戻る）。
            Assert.True(await boards.RemoveMemberAsync(world.OwnerBoard, Stranger, Stranger));

            var task = await tasks.GetByIdAsync(taskId, Owner);
            Assert.NotNull(task);
            Assert.Null(task!.AssigneeId);
        }

        // ---- 2 ユーザー分の board / position / category を用意する ----

        private record World(
            Guid OwnerBoard, Guid OwnerPosition, Guid OwnerCategory,
            Guid StrangerBoard, Guid StrangerPosition, Guid StrangerCategory);

        private static async Task<World> SeedWorldAsync(IDbConnection connection)
        {
            await SeedUserAsync(connection, Owner, "owner@example.com");
            await SeedUserAsync(connection, Stranger, "stranger@example.com");

            var boards = new BoardRepository(connection);
            var positions = new PositionRepository(connection);
            var categories = new CategoryRepository(connection);

            var world = new World(
                OwnerBoard: Guid.NewGuid(), OwnerPosition: Guid.NewGuid(), OwnerCategory: Guid.NewGuid(),
                StrangerBoard: Guid.NewGuid(), StrangerPosition: Guid.NewGuid(), StrangerCategory: Guid.NewGuid());

            await boards.CreateAsync(new CreateBoardRequest
            { Id = world.OwnerBoard, UserId = Owner, ShortName = "OWN", Title = "所有" });
            await boards.CreateAsync(new CreateBoardRequest
            { Id = world.StrangerBoard, UserId = Stranger, ShortName = "OTH", Title = "他人" });

            await positions.CreateAsync(new CreatePositionRequest
            { Id = world.OwnerPosition, BoardId = world.OwnerBoard, Name = "Todo", OrderIndex = 0 }, Owner);
            await positions.CreateAsync(new CreatePositionRequest
            { Id = world.StrangerPosition, BoardId = world.StrangerBoard, Name = "Todo", OrderIndex = 0 }, Stranger);

            await categories.CreateAsync(new CreateCategoryRequest
            { Id = world.OwnerCategory, BoardId = world.OwnerBoard, Name = "仕事", Color = "#ff0000" }, Owner);
            await categories.CreateAsync(new CreateCategoryRequest
            { Id = world.StrangerCategory, BoardId = world.StrangerBoard, Name = "私用", Color = "#00ff00" }, Stranger);

            return world;
        }

        private static CreateTaskRequest NewTask(Guid id, Guid boardId, Guid positionId) => new()
        {
            Id = id,
            BoardId = boardId,
            PositionId = positionId,
            Name = "タスク",
            OrderIndex = 0,
        };
    }
}
