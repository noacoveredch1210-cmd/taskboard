using System.Data;
using Dapper;
using TaskBoard.Server.Data;
using TaskBoard.Server.IntegrationTests.Infrastructure;
using TaskBoard.Server.Models;

namespace TaskBoard.Server.IntegrationTests.Repositories
{
    /// <summary>
    /// schema.sql が定める外部キーの削除時挙動を確かめる。
    /// これらはアプリのコードではなく DB 側の制約なので、実 DB でしか検証できない。
    /// </summary>
    public class SchemaConstraintTests : IntegrationTestBase
    {
        private static readonly Guid User = Guid.NewGuid();

        public SchemaConstraintTests(PostgresFixture fixture) : base(fixture) { }

        [SkippableFact]
        public async Task position_を消すとタスクは残り_position_idがnullになる()
        {
            RequireDocker();
            using var connection = await Fixture.OpenConnectionAsync();
            await SeedUserAsync(connection, User, "user@example.com");

            var boardId = Guid.NewGuid();
            var positionId = Guid.NewGuid();
            var taskId = Guid.NewGuid();
            await new BoardRepository(connection).CreateAsync(new CreateBoardRequest
            { Id = boardId, UserId = User, ShortName = "B", Title = "T" });
            await new PositionRepository(connection).CreateAsync(new CreatePositionRequest
            { Id = positionId, BoardId = boardId, Name = "Todo", OrderIndex = 0 }, User);
            await new TaskRepository(connection).CreateAsync(new CreateTaskRequest
            { Id = taskId, BoardId = boardId, PositionId = positionId, Name = "タスク" }, User);

            // 列を削除しても、そこにあったタスクは未配置として残す（ON DELETE SET NULL）。
            await new PositionRepository(connection).DeleteAsync(positionId, User);

            var task = await new TaskRepository(connection).GetByIdAsync(taskId, User);
            Assert.NotNull(task);
            Assert.Null(task!.PositionId); // 列が消え、position_id が NULL になっている
        }

        [SkippableFact]
        public async Task board_を消すと配下のposition_taskも消える()
        {
            RequireDocker();
            using var connection = await Fixture.OpenConnectionAsync();
            await SeedUserAsync(connection, User, "user@example.com");

            var boardId = Guid.NewGuid();
            var positionId = Guid.NewGuid();
            var taskId = Guid.NewGuid();
            await new BoardRepository(connection).CreateAsync(new CreateBoardRequest
            { Id = boardId, UserId = User, ShortName = "B", Title = "T" });
            await new PositionRepository(connection).CreateAsync(new CreatePositionRequest
            { Id = positionId, BoardId = boardId, Name = "Todo", OrderIndex = 0 }, User);
            await new TaskRepository(connection).CreateAsync(new CreateTaskRequest
            { Id = taskId, BoardId = boardId, PositionId = positionId, Name = "タスク" }, User);

            await new BoardRepository(connection).DeleteAsync(boardId, User);

            // board の削除が positions / tasks まで連鎖する（ON DELETE CASCADE）。
            Assert.Equal(0, await CountAsync(connection, "positions"));
            Assert.Equal(0, await CountAsync(connection, "tasks"));
        }

        [SkippableFact]
        public async Task 認証ユーザーを消すとアプリデータが連鎖削除される()
        {
            RequireDocker();
            using var connection = await Fixture.OpenConnectionAsync();
            await SeedUserAsync(connection, User, "user@example.com");
            await new BoardRepository(connection).CreateAsync(new CreateBoardRequest
            { Id = Guid.NewGuid(), UserId = User, ShortName = "B", Title = "T" });

            // Supabase 側で認証ユーザーを削除したときに孤児を残さない（migrations/0002 の意図）。
            await connection.ExecuteAsync("DELETE FROM auth.users WHERE id = @Id", new { Id = User });

            Assert.Equal(0, await CountAsync(connection, "users"));
            Assert.Equal(0, await CountAsync(connection, "boards"));
        }

        [SkippableFact]
        public async Task 退会でユーザー行を消すとboardもcategoryも連鎖削除される()
        {
            RequireDocker();
            using var connection = await Fixture.OpenConnectionAsync();
            await SeedUserAsync(connection, User, "user@example.com");
            var boardId = Guid.NewGuid();
            await new BoardRepository(connection).CreateAsync(new CreateBoardRequest
            { Id = boardId, UserId = User, ShortName = "B", Title = "T" });
            await new CategoryRepository(connection).CreateAsync(new CreateCategoryRequest
            { Id = Guid.NewGuid(), BoardId = boardId, Name = "仕事", Color = "#ff0000" }, User);

            // 退会：アプリ上の users 行を削除する（UserRepository.DeleteAsync と同じ経路）。
            var deleted = await new UserRepository(connection).DeleteAsync(User);

            Assert.True(deleted);
            Assert.Equal(0, await CountAsync(connection, "users"));
            Assert.Equal(0, await CountAsync(connection, "boards"));
            Assert.Equal(0, await CountAsync(connection, "categories"));
        }

        private static async Task<int> CountAsync(IDbConnection connection, string table) =>
            await connection.ExecuteScalarAsync<int>($"SELECT COUNT(*) FROM {table}");
    }
}
