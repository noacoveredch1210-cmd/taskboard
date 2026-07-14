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
        public async Task GetForUser_は参加しているboardだけを返す()
        {
            RequireDocker();
            using var connection = await Fixture.OpenConnectionAsync();
            await SeedUserAsync(connection, Owner, "owner@example.com");
            await SeedUserAsync(connection, Stranger, "stranger@example.com");
            var repository = new BoardRepository(connection);

            var mine = Guid.NewGuid();
            await repository.CreateAsync(NewBoard(mine, Owner, "MINE"));
            await repository.CreateAsync(NewBoard(Guid.NewGuid(), Stranger, "THEIRS"));

            var boards = (await repository.GetForUserAsync(Owner)).ToList();

            Assert.Single(boards);
            Assert.Equal(mine, boards[0].Id);
            Assert.Equal("owner", boards[0].Role); // 作成者は owner として参加している
        }

        [SkippableFact]
        public async Task 共有トークンで参加するとメンバーになりboardが見える()
        {
            RequireDocker();
            using var connection = await Fixture.OpenConnectionAsync();
            await SeedUserAsync(connection, Owner, "owner@example.com");
            await SeedUserAsync(connection, Stranger, "stranger@example.com");
            var repository = new BoardRepository(connection);

            var boardId = Guid.NewGuid();
            await repository.CreateAsync(NewBoard(boardId, Owner, "SHARED"));

            // 参加前は Stranger からは見えない。
            Assert.Null(await repository.GetByIdAsync(boardId, Stranger));

            // オーナーだけが共有トークンを取れる。
            var token = await repository.GetShareTokenAsync(boardId, Owner);
            Assert.NotNull(token);
            Assert.Null(await repository.GetShareTokenAsync(boardId, Stranger));

            // トークンで参加しても即メンバーにはならず、承認待ち（まだ見えない）。
            var outcome = await repository.RequestJoinByTokenAsync(token!.Value, Stranger);
            Assert.Equal(JoinResult.Requested, outcome.Result);
            Assert.Null(await repository.GetByIdAsync(boardId, Stranger));

            // オーナーにはリクエストが見え、承認するとメンバーになって board が見える。
            var requests = (await repository.GetJoinRequestsAsync(boardId, Owner)).ToList();
            Assert.Single(requests);
            Assert.Equal(Stranger, requests[0].UserId);

            Assert.True(await repository.ApproveJoinRequestAsync(boardId, Owner, Stranger));
            var joined = await repository.GetByIdAsync(boardId, Stranger);
            Assert.NotNull(joined);
            Assert.Equal("member", joined!.Role);
        }

        [SkippableFact]
        public async Task boardの編集と削除はオーナーのみ_メンバーは不可()
        {
            RequireDocker();
            using var connection = await Fixture.OpenConnectionAsync();
            await SeedUserAsync(connection, Owner, "owner@example.com");
            await SeedUserAsync(connection, Stranger, "stranger@example.com");
            var repository = new BoardRepository(connection);

            var boardId = Guid.NewGuid();
            await repository.CreateAsync(NewBoard(boardId, Owner, "SHARED"));
            await JoinAndApproveAsync(repository, boardId, Owner, Stranger);

            var request = new UpdateBoardRequest { ShortName = "UPD", Title = "更新" };

            // メンバー（Stranger）は編集も削除もできない。
            Assert.False(await repository.UpdateAsync(boardId, Stranger, request));
            Assert.False(await repository.DeleteAsync(boardId, Stranger));

            // オーナーは編集・削除できる。
            Assert.True(await repository.UpdateAsync(boardId, Owner, request));
            Assert.True(await repository.DeleteAsync(boardId, Owner));
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

        [SkippableFact]
        public async Task オーナーはメンバーを昇格でき_最後のオーナーは降格できない()
        {
            RequireDocker();
            using var connection = await Fixture.OpenConnectionAsync();
            await SeedUserAsync(connection, Owner, "owner@example.com");
            await SeedUserAsync(connection, Stranger, "stranger@example.com");
            var repository = new BoardRepository(connection);

            var boardId = Guid.NewGuid();
            await repository.CreateAsync(NewBoard(boardId, Owner, "SHARED"));
            await JoinAndApproveAsync(repository, boardId, Owner, Stranger);

            // メンバーは役割変更できない。
            Assert.False(await repository.SetMemberRoleAsync(boardId, Stranger, Owner, "member"));

            // オーナーが Stranger を昇格。
            Assert.True(await repository.SetMemberRoleAsync(boardId, Owner, Stranger, "owner"));
            var members = (await repository.GetMembersAsync(boardId, Owner)).ToList();
            Assert.Equal(2, members.Count(m => m.Role == "owner"));

            // オーナーが 2 人いれば片方を降格できる。
            Assert.True(await repository.SetMemberRoleAsync(boardId, Owner, Stranger, "member"));

            // 残り 1 人のオーナー（Owner 自身）は降格できない。
            Assert.False(await repository.SetMemberRoleAsync(boardId, Owner, Owner, "member"));
        }

        /// <summary>共有トークンで参加リクエストを出し、オーナーが承認してメンバーにする。</summary>
        private static async Task JoinAndApproveAsync(
            BoardRepository repository, Guid boardId, Guid owner, Guid requester)
        {
            var token = await repository.GetShareTokenAsync(boardId, owner);
            await repository.RequestJoinByTokenAsync(token!.Value, requester);
            await repository.ApproveJoinRequestAsync(boardId, owner, requester);
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
