using TaskBoard.Server.Data;
using TaskBoard.Server.IntegrationTests.Infrastructure;
using TaskBoard.Server.Models;

namespace TaskBoard.Server.IntegrationTests.Repositories
{
    public class BoardRepositoryTests : IntegrationTestBase
    {
        private static readonly Guid Owner = Guid.NewGuid();
        private static readonly Guid Stranger = Guid.NewGuid();

        public BoardRepositoryTests(PostgresFixture fixture) : base(fixture) { }

        [SkippableFact]
        public async Task GetByUserId_は自分のboardだけを返す()
        {
            RequireDocker();
            using var connection = await Fixture.OpenConnectionAsync();
            await SeedUserAsync(connection, Owner, "owner@example.com");
            await SeedUserAsync(connection, Stranger, "stranger@example.com");
            var repository = new BoardRepository(connection);

            var mine = Guid.NewGuid();
            await repository.CreateAsync(NewBoard(mine, Owner, "MINE"));
            await repository.CreateAsync(NewBoard(Guid.NewGuid(), Stranger, "THEIRS"));

            var boards = (await repository.GetByUserIdAsync(Owner)).ToList();

            Assert.Single(boards);
            Assert.Equal(mine, boards[0].Id);
        }

        [SkippableFact]
        public async Task GetById_は他人のboardにはnullを返す()
        {
            RequireDocker();
            using var connection = await Fixture.OpenConnectionAsync();
            await SeedUserAsync(connection, Owner, "owner@example.com");
            await SeedUserAsync(connection, Stranger, "stranger@example.com");
            var repository = new BoardRepository(connection);

            var boardId = Guid.NewGuid();
            await repository.CreateAsync(NewBoard(boardId, Owner, "MINE"));

            // 本人からは見えるが、他人からは存在ごと隠れる（コントローラーはこれを 404 に変換する）。
            Assert.NotNull(await repository.GetByIdAsync(boardId, Owner));
            Assert.Null(await repository.GetByIdAsync(boardId, Stranger));
        }

        [SkippableFact]
        public async Task Update_は他人のboardには効かず_falseを返す()
        {
            RequireDocker();
            using var connection = await Fixture.OpenConnectionAsync();
            await SeedUserAsync(connection, Owner, "owner@example.com");
            await SeedUserAsync(connection, Stranger, "stranger@example.com");
            var repository = new BoardRepository(connection);

            var boardId = Guid.NewGuid();
            await repository.CreateAsync(NewBoard(boardId, Owner, "MINE"));

            var request = new UpdateBoardRequest { ShortName = "HACKED", Title = "乗っ取り" };

            Assert.False(await repository.UpdateAsync(boardId, Stranger, request));

            // 他人の更新は行に届いていない（値が元のまま）。
            var board = await repository.GetByIdAsync(boardId, Owner);
            Assert.Equal("MINE", board!.ShortName);
        }

        [SkippableFact]
        public async Task Delete_は他人のboardには効かず_falseを返す()
        {
            RequireDocker();
            using var connection = await Fixture.OpenConnectionAsync();
            await SeedUserAsync(connection, Owner, "owner@example.com");
            await SeedUserAsync(connection, Stranger, "stranger@example.com");
            var repository = new BoardRepository(connection);

            var boardId = Guid.NewGuid();
            await repository.CreateAsync(NewBoard(boardId, Owner, "MINE"));

            Assert.False(await repository.DeleteAsync(boardId, Stranger));
            Assert.NotNull(await repository.GetByIdAsync(boardId, Owner));

            Assert.True(await repository.DeleteAsync(boardId, Owner));
            Assert.Null(await repository.GetByIdAsync(boardId, Owner));
        }

        private static CreateBoardRequest NewBoard(Guid id, Guid userId, string shortName) => new()
        {
            Id = id,
            UserId = userId,
            ShortName = shortName,
            Title = "タイトル",
        };
    }
}
