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

        // ---- 列の編集（1 リクエストで追加・改名・並べ替え・削除をまとめて適用する） ----

        [SkippableFact]
        public async Task Update_は列の追加_改名_並べ替え_削除をまとめて反映する()
        {
            RequireDocker();
            using var connection = await Fixture.OpenConnectionAsync();
            await SeedUserAsync(connection, Owner, "owner@example.com");
            var boards = new BoardRepository(connection);
            var positions = new PositionRepository(connection);

            var boardId = Guid.NewGuid();
            await boards.CreateAsync(NewBoard(boardId, Owner, "BD"));
            var (todo, doing, gone) = (Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
            foreach (var (id, name, index) in new[]
            {
                (todo, "Todo", 0.0), (doing, "Doing", 1.0), (gone, "消える", 2.0),
            })
            {
                await positions.CreateAsync(new CreatePositionRequest
                { Id = id, BoardId = boardId, Name = name, OrderIndex = index }, Owner);
            }

            // Doing を先頭へ、Todo を改名、消えるを削除、新規を末尾へ。
            var added = Guid.NewGuid();
            Assert.True(await boards.UpdateAsync(boardId, Owner, new UpdateBoardRequest
            {
                ShortName = "BD",
                Title = "ボード",
                Positions =
                [
                    new BoardPositionRequest { Id = doing, Name = "Doing" },
                    new BoardPositionRequest { Id = todo, Name = "改名後" },
                    new BoardPositionRequest { Id = added, Name = "新規" },
                ],
            }));

            var result = (await positions.GetByBoardIdAsync(boardId, Owner)).ToList();
            Assert.Equal([doing, todo, added], result.Select(p => p.Id));
            Assert.Equal("改名後", result[1].Name);
        }

        /// <summary>
        /// 列を消すとタスクは FK の ON DELETE SET NULL で未配置になり、画面から見えなくなる。
        /// 「退避してから削除」の順序は、同じトランザクションの中だから保証できる。
        /// </summary>
        [SkippableFact]
        public async Task Update_で消えた列にあったタスクは先頭の列へ退避される()
        {
            RequireDocker();
            using var connection = await Fixture.OpenConnectionAsync();
            await SeedUserAsync(connection, Owner, "owner@example.com");
            var boards = new BoardRepository(connection);
            var positions = new PositionRepository(connection);
            var tasks = new TaskRepository(connection);

            var boardId = Guid.NewGuid();
            await boards.CreateAsync(NewBoard(boardId, Owner, "BD"));
            var (keep, gone) = (Guid.NewGuid(), Guid.NewGuid());
            await positions.CreateAsync(new CreatePositionRequest
            { Id = keep, BoardId = boardId, Name = "残る", OrderIndex = 0 }, Owner);
            await positions.CreateAsync(new CreatePositionRequest
            { Id = gone, BoardId = boardId, Name = "消える", OrderIndex = 1 }, Owner);

            var taskId = Guid.NewGuid();
            await tasks.CreateAsync(new CreateTaskRequest
            { Id = taskId, BoardId = boardId, PositionId = gone, Name = "タスク" }, Owner);

            await boards.UpdateAsync(boardId, Owner, new UpdateBoardRequest
            {
                ShortName = "BD",
                Title = "ボード",
                Positions = [new BoardPositionRequest { Id = keep, Name = "残る" }],
            });

            var moved = await tasks.GetByIdAsync(taskId, Owner);
            Assert.Equal(keep, moved!.PositionId); // 未配置(null)にならず、残った列へ移る
        }

        [SkippableFact]
        public async Task Update_は他boardの列idを送られても書き換えない()
        {
            RequireDocker();
            using var connection = await Fixture.OpenConnectionAsync();
            await SeedUserAsync(connection, Owner, "owner@example.com");
            await SeedUserAsync(connection, Stranger, "stranger@example.com");
            var boards = new BoardRepository(connection);
            var positions = new PositionRepository(connection);

            var mine = Guid.NewGuid();
            var theirs = Guid.NewGuid();
            await boards.CreateAsync(NewBoard(mine, Owner, "MINE"));
            await boards.CreateAsync(NewBoard(theirs, Stranger, "THEIRS"));

            var theirPosition = Guid.NewGuid();
            await positions.CreateAsync(new CreatePositionRequest
            { Id = theirPosition, BoardId = theirs, Name = "他人の列", OrderIndex = 0 }, Stranger);

            // 自分の board の編集に、他人の board の列 id を混ぜて送る。
            await boards.UpdateAsync(mine, Owner, new UpdateBoardRequest
            {
                ShortName = "MINE",
                Title = "私のボード",
                Positions = [new BoardPositionRequest { Id = theirPosition, Name = "乗っ取り" }],
            });

            // 他人の列は名前も所属も変わらない。
            var theirResult = (await positions.GetByBoardIdAsync(theirs, Stranger)).ToList();
            Assert.Single(theirResult);
            Assert.Equal("他人の列", theirResult[0].Name);
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

        [SkippableFact]
        public async Task メンバーは退出できる_他人は外せない()
        {
            RequireDocker();
            using var connection = await Fixture.OpenConnectionAsync();
            await SeedUserAsync(connection, Owner, "owner@example.com");
            await SeedUserAsync(connection, Stranger, "stranger@example.com");
            var repository = new BoardRepository(connection);

            var boardId = Guid.NewGuid();
            await repository.CreateAsync(NewBoard(boardId, Owner, "SHARED"));
            await JoinAndApproveAsync(repository, boardId, Owner, Stranger);

            // メンバー（Stranger）は自分で退出できる。
            Assert.True(await repository.RemoveMemberAsync(boardId, Stranger, Stranger));
            Assert.Null(await repository.GetByIdAsync(boardId, Stranger));
        }

        [SkippableFact]
        public async Task オーナーは他にオーナーがいれば退出でき_最後のオーナーは退出できない()
        {
            RequireDocker();
            using var connection = await Fixture.OpenConnectionAsync();
            await SeedUserAsync(connection, Owner, "owner@example.com");
            await SeedUserAsync(connection, Stranger, "stranger@example.com");
            var repository = new BoardRepository(connection);

            var boardId = Guid.NewGuid();
            await repository.CreateAsync(NewBoard(boardId, Owner, "SHARED"));

            // まだ 1 人しかオーナーがいないので、Owner は退出できない。
            Assert.False(await repository.RemoveMemberAsync(boardId, Owner, Owner));
            Assert.NotNull(await repository.GetByIdAsync(boardId, Owner));

            // Stranger を招いてオーナーに昇格すると、オーナーは 2 人になる。
            await JoinAndApproveAsync(repository, boardId, Owner, Stranger);
            await repository.SetMemberRoleAsync(boardId, Owner, Stranger, "owner");

            // 他にオーナーがいるので Owner は退出できる。
            Assert.True(await repository.RemoveMemberAsync(boardId, Owner, Owner));
            Assert.Null(await repository.GetByIdAsync(boardId, Owner));

            // 残った Stranger は最後のオーナーなので退出できない。
            Assert.False(await repository.RemoveMemberAsync(boardId, Stranger, Stranger));
        }

        [SkippableFact]
        public async Task オーナーは他人のオーナーを外せない()
        {
            RequireDocker();
            using var connection = await Fixture.OpenConnectionAsync();
            await SeedUserAsync(connection, Owner, "owner@example.com");
            await SeedUserAsync(connection, Stranger, "stranger@example.com");
            var repository = new BoardRepository(connection);

            var boardId = Guid.NewGuid();
            await repository.CreateAsync(NewBoard(boardId, Owner, "SHARED"));
            await JoinAndApproveAsync(repository, boardId, Owner, Stranger);
            await repository.SetMemberRoleAsync(boardId, Owner, Stranger, "owner");

            // オーナー同士でも、他人のオーナーは外せない（本人の退出のみ）。
            Assert.False(await repository.RemoveMemberAsync(boardId, Owner, Stranger));
            Assert.NotNull(await repository.GetByIdAsync(boardId, Stranger));
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
