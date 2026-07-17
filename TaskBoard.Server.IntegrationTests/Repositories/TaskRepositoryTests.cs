using System.Data;
using Dapper;
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
        public async Task 削除はオーナーのみ_メンバーは削除できない()
        {
            RequireDocker();
            using var connection = await Fixture.OpenConnectionAsync();
            var world = await SeedWorldAsync(connection);
            var boards = new BoardRepository(connection);
            var tasks = new TaskRepository(connection);

            // Stranger を OwnerBoard の「メンバー」にする。
            var token = await boards.GetShareTokenAsync(world.OwnerBoard, Owner);
            await boards.RequestJoinByTokenAsync(token!.Value, Stranger);
            await boards.ApproveJoinRequestAsync(world.OwnerBoard, Owner, Stranger);

            var taskId = Guid.NewGuid();
            await tasks.CreateAsync(NewTask(taskId, world.OwnerBoard, world.OwnerPosition), Stranger);

            // メンバー（Stranger）は削除できない。
            Assert.False(await tasks.DeleteAsync(taskId, Stranger));
            Assert.NotNull(await tasks.GetByIdAsync(taskId, Stranger));

            // オーナーは削除できる。
            Assert.True(await tasks.DeleteAsync(taskId, Owner));
        }

        [SkippableFact]
        public async Task ソフト削除されたタスクは一覧から消えゴミ箱に入る_復元で戻る()
        {
            RequireDocker();
            using var connection = await Fixture.OpenConnectionAsync();
            var world = await SeedWorldAsync(connection);
            var repository = new TaskRepository(connection);

            var taskId = Guid.NewGuid();
            await repository.CreateAsync(NewTask(taskId, world.OwnerBoard, world.OwnerPosition), Owner);

            await repository.DeleteAsync(taskId, Owner);

            // 通常の一覧からは消え、ゴミ箱に入る。
            Assert.Empty(await repository.GetByBoardIdAsync(world.OwnerBoard, Owner));
            var trash = (await repository.GetTrashByBoardIdAsync(world.OwnerBoard, Owner)).ToList();
            Assert.Single(trash);
            Assert.Equal(taskId, trash[0].Id);

            // 復元すると一覧へ戻り、ゴミ箱から消える。
            Assert.True(await repository.RestoreAsync(taskId, Owner));
            Assert.Single(await repository.GetByBoardIdAsync(world.OwnerBoard, Owner));
            Assert.Empty(await repository.GetTrashByBoardIdAsync(world.OwnerBoard, Owner));
        }

        [SkippableFact]
        public async Task ゴミ箱の閲覧復元完全削除はオーナーのみ()
        {
            RequireDocker();
            using var connection = await Fixture.OpenConnectionAsync();
            var world = await SeedWorldAsync(connection);
            var boards = new BoardRepository(connection);
            var tasks = new TaskRepository(connection);

            // Stranger を OwnerBoard のメンバーにする。
            var token = await boards.GetShareTokenAsync(world.OwnerBoard, Owner);
            await boards.RequestJoinByTokenAsync(token!.Value, Stranger);
            await boards.ApproveJoinRequestAsync(world.OwnerBoard, Owner, Stranger);

            var taskId = Guid.NewGuid();
            await tasks.CreateAsync(NewTask(taskId, world.OwnerBoard, world.OwnerPosition), Owner);
            await tasks.DeleteAsync(taskId, Owner);

            // メンバーはゴミ箱を見られず、復元も完全削除もできない。
            Assert.Empty(await tasks.GetTrashByBoardIdAsync(world.OwnerBoard, Stranger));
            Assert.False(await tasks.RestoreAsync(taskId, Stranger));
            Assert.False(await tasks.PurgeAsync(taskId, Stranger));

            // オーナーは完全削除できる（ゴミ箱からも消える）。
            Assert.True(await tasks.PurgeAsync(taskId, Owner));
            Assert.Empty(await tasks.GetTrashByBoardIdAsync(world.OwnerBoard, Owner));
        }

        [SkippableFact]
        public async Task ゴミ箱を空にできるのはオーナーのみ()
        {
            RequireDocker();
            using var connection = await Fixture.OpenConnectionAsync();
            var world = await SeedWorldAsync(connection);
            var boards = new BoardRepository(connection);
            var tasks = new TaskRepository(connection);

            // Stranger を OwnerBoard のメンバーにする。
            var token = await boards.GetShareTokenAsync(world.OwnerBoard, Owner);
            await boards.RequestJoinByTokenAsync(token!.Value, Stranger);
            await boards.ApproveJoinRequestAsync(world.OwnerBoard, Owner, Stranger);

            // 2 件作って削除（ゴミ箱に 2 件）。
            foreach (var _ in new[] { 0, 1 })
            {
                var id = Guid.NewGuid();
                await tasks.CreateAsync(NewTask(id, world.OwnerBoard, world.OwnerPosition), Owner);
                await tasks.DeleteAsync(id, Owner);
            }
            Assert.Equal(2, (await tasks.GetTrashByBoardIdAsync(world.OwnerBoard, Owner)).Count());

            // メンバーは空にできない。
            Assert.False(await tasks.PurgeAllAsync(world.OwnerBoard, Stranger));
            Assert.Equal(2, (await tasks.GetTrashByBoardIdAsync(world.OwnerBoard, Owner)).Count());

            // オーナーは空にできる。
            Assert.True(await tasks.PurgeAllAsync(world.OwnerBoard, Owner));
            Assert.Empty(await tasks.GetTrashByBoardIdAsync(world.OwnerBoard, Owner));
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

        // ---- 移動（order_index の採番はサーバーが持つ） ----

        [SkippableFact]
        public async Task Move_は両隣の中間値を採番する()
        {
            RequireDocker();
            using var connection = await Fixture.OpenConnectionAsync();
            var world = await SeedWorldAsync(connection);
            var repository = new TaskRepository(connection);

            var (a, b, c) = (Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
            await SeedColumnAsync(connection, repository, world, [(a, 0), (b, 1), (c, 2)]);

            // c を a と b の間へ。
            await repository.MoveAsync(c, Owner, new MoveTaskRequest
            { PositionId = world.OwnerPosition, PrevTaskId = a, NextTaskId = b });

            var moved = await repository.GetByIdAsync(c, Owner);
            Assert.Equal(0.5, moved!.OrderIndex);
            Assert.Equal([a, c, b], await ColumnOrderAsync(repository, world));
        }

        [SkippableFact]
        public async Task Move_は先頭と末尾も採番できる()
        {
            RequireDocker();
            using var connection = await Fixture.OpenConnectionAsync();
            var world = await SeedWorldAsync(connection);
            var repository = new TaskRepository(connection);

            var (a, b) = (Guid.NewGuid(), Guid.NewGuid());
            await SeedColumnAsync(connection, repository, world, [(a, 0), (b, 1)]);

            // b を先頭へ（prev なし）
            await repository.MoveAsync(b, Owner, new MoveTaskRequest
            { PositionId = world.OwnerPosition, PrevTaskId = null, NextTaskId = a });
            Assert.Equal([b, a], await ColumnOrderAsync(repository, world));

            // b を末尾へ（next なし）
            await repository.MoveAsync(b, Owner, new MoveTaskRequest
            { PositionId = world.OwnerPosition, PrevTaskId = a, NextTaskId = null });
            Assert.Equal([a, b], await ColumnOrderAsync(repository, world));
        }

        /// <summary>
        /// 本命。中間値が枯渇するまで同じ隙間へ入れ続け、振り直しが起きても
        /// 並び順が保たれることを実 DB で確かめる。クライアント側の実装では
        /// 振り直しが複数 UPDATE に分かれるため、途中で失敗すると順序が壊れていた。
        /// </summary>
        [SkippableFact]
        public async Task Move_は精度が枯渇したら振り直して並び順を保つ()
        {
            RequireDocker();
            using var connection = await Fixture.OpenConnectionAsync();
            var world = await SeedWorldAsync(connection);
            var repository = new TaskRepository(connection);

            var (bottom, top) = (Guid.NewGuid(), Guid.NewGuid());
            await SeedColumnAsync(connection, repository, world, [(bottom, 0), (top, 1)]);

            // bottom と top の隙間の「上側」へ詰め続ける。53 回ほどで中間値が作れなくなる。
            var inserted = new List<Guid>();
            var prev = bottom;
            for (var i = 0; i < 60; i++)
            {
                var id = Guid.NewGuid();
                await repository.CreateAsync(
                    NewTask(id, world.OwnerBoard, world.OwnerPosition), Owner);
                Assert.True(await repository.MoveAsync(id, Owner, new MoveTaskRequest
                { PositionId = world.OwnerPosition, PrevTaskId = prev, NextTaskId = top }));
                inserted.Add(id);
                prev = id; // 次はこのカードの上（＝ top 側）へ詰める
            }

            // 期待する並び: bottom, 入れた順, top
            var expected = new List<Guid> { bottom };
            expected.AddRange(inserted);
            expected.Add(top);
            Assert.Equal(expected, await ColumnOrderAsync(repository, world));

            // 振り直しが起きているので、値は密集していない（隣同士が区別できる）。
            var indexes = (await repository.GetByBoardIdAsync(world.OwnerBoard, Owner))
                .OrderBy(t => t.OrderIndex).Select(t => t.OrderIndex).ToList();
            for (var i = 1; i < indexes.Count; i++)
                Assert.True(indexes[i] > indexes[i - 1], "order_index が重複または逆転している");
        }

        [SkippableFact]
        public async Task Move_はメンバーでなければ動かせない()
        {
            RequireDocker();
            using var connection = await Fixture.OpenConnectionAsync();
            var world = await SeedWorldAsync(connection);
            var repository = new TaskRepository(connection);

            var (a, b) = (Guid.NewGuid(), Guid.NewGuid());
            await SeedColumnAsync(connection, repository, world, [(a, 0), (b, 1)]);

            Assert.False(await repository.MoveAsync(b, Stranger, new MoveTaskRequest
            { PositionId = world.OwnerPosition, PrevTaskId = null, NextTaskId = a }));
            // 並びは変わっていない
            Assert.Equal([a, b], await ColumnOrderAsync(repository, world));
        }

        [SkippableFact]
        public async Task Move_は他boardのpositionへは動かせない()
        {
            RequireDocker();
            using var connection = await Fixture.OpenConnectionAsync();
            var world = await SeedWorldAsync(connection);
            var repository = new TaskRepository(connection);

            var a = Guid.NewGuid();
            await SeedColumnAsync(connection, repository, world, [(a, 0)]);

            Assert.False(await repository.MoveAsync(a, Owner, new MoveTaskRequest
            { PositionId = world.StrangerPosition }));
        }

        [SkippableFact]
        public async Task Move_は別カラムのタスクを隣に指定させない()
        {
            RequireDocker();
            using var connection = await Fixture.OpenConnectionAsync();
            var world = await SeedWorldAsync(connection);
            var repository = new TaskRepository(connection);

            var a = Guid.NewGuid();
            await SeedColumnAsync(connection, repository, world, [(a, 0)]);

            // 他人の board のタスクを prev に指定する。
            var alien = Guid.NewGuid();
            await repository.CreateAsync(
                NewTask(alien, world.StrangerBoard, world.StrangerPosition), Stranger);

            Assert.False(await repository.MoveAsync(a, Owner, new MoveTaskRequest
            { PositionId = world.OwnerPosition, PrevTaskId = alien }));
        }

        /// <summary>
        /// 指定の order_index でタスクを並べる。
        /// 作成は常に「カラムの先頭」に入る仕様なので、狙った並びを作るために
        /// 作成後に order_index を直接書き換える（テストの前提づくり）。
        /// </summary>
        private static async Task SeedColumnAsync(
            IDbConnection connection, TaskRepository repository, World world,
            (Guid Id, double OrderIndex)[] tasks)
        {
            foreach (var (id, orderIndex) in tasks)
            {
                await repository.CreateAsync(
                    NewTask(id, world.OwnerBoard, world.OwnerPosition), Owner);
                await connection.ExecuteAsync(
                    "UPDATE tasks SET order_index = @OrderIndex WHERE id = @Id",
                    new { Id = id, OrderIndex = orderIndex });
            }
        }

        /// <summary>カラムの並び（order_index 昇順の id）。</summary>
        private static async Task<List<Guid>> ColumnOrderAsync(
            TaskRepository repository, World world) =>
            (await repository.GetByBoardIdAsync(world.OwnerBoard, Owner))
                .OrderBy(t => t.OrderIndex).Select(t => t.Id).ToList();

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
        };
    }
}
