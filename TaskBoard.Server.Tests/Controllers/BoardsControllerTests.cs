using Microsoft.AspNetCore.Mvc;
using NSubstitute;
using TaskBoard.Server.Controllers;
using TaskBoard.Server.Data;
using TaskBoard.Server.Models;
using TaskBoard.Server.Tests.Support;

namespace TaskBoard.Server.Tests.Controllers
{
    public class BoardsControllerTests
    {
        private readonly IBoardRepository _repository = Substitute.For<IBoardRepository>();
        private readonly Guid _userId = Guid.NewGuid();

        private BoardsController CreateController() =>
            new BoardsController(_repository).WithUser(_userId);

        [Fact]
        public async Task GetMine_ReturnsBoardsOfAuthenticatedUser()
        {
            var boards = new[] { new Board { Id = Guid.NewGuid(), UserId = _userId } };
            _repository.GetForUserAsync(_userId).Returns(boards);

            var result = await CreateController().GetMine();

            var ok = Assert.IsType<OkObjectResult>(result);
            Assert.Same(boards, ok.Value);
        }

        [Fact]
        public async Task GetMine_DoesNotLeakOtherUsersBoards()
        {
            _repository.GetForUserAsync(Arg.Any<Guid>()).Returns([]);

            await CreateController().GetMine();

            // 一覧取得は必ずトークンのユーザー ID で問い合わせる。
            await _repository.Received(1).GetForUserAsync(_userId);
        }

        [Fact]
        public async Task GetById_ReturnsBoard_WhenOwnedByAuthenticatedUser()
        {
            var id = Guid.NewGuid();
            var board = new Board { Id = id, UserId = _userId };
            _repository.GetByIdAsync(id, _userId).Returns(board);

            var result = await CreateController().GetById(id);

            var ok = Assert.IsType<OkObjectResult>(result);
            Assert.Same(board, ok.Value);
        }

        [Fact]
        public async Task GetById_ScopesLookupToAuthenticatedUser()
        {
            var id = Guid.NewGuid();

            await CreateController().GetById(id);

            // 他人の board を引けないよう、所有者 ID 付きで問い合わせる。
            await _repository.Received(1).GetByIdAsync(id, _userId);
        }

        [Fact]
        public async Task GetById_ReturnsNotFound_WhenMissingOrNotOwned()
        {
            _repository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<Guid>()).Returns((Board?)null);

            var result = await CreateController().GetById(Guid.NewGuid());

            Assert.IsType<NotFoundResult>(result);
        }

        [Fact]
        public async Task Create_OverwritesUserIdWithTokenUser()
        {
            // 攻撃者が body で他人の userId を指定しても、トークンのユーザーに矯正される。
            var request = new CreateBoardRequest
            {
                Id = Guid.NewGuid(),
                UserId = Guid.NewGuid(),
                ShortName = "TB",
                Title = "TaskBoard",
            };

            await CreateController().Create(request);

            await _repository.Received(1).CreateAsync(Arg.Is<CreateBoardRequest>(r => r.UserId == _userId));
        }

        [Fact]
        public async Task Create_ReturnsCreatedAtActionWithPersistedBoard()
        {
            var request = new CreateBoardRequest { Id = Guid.NewGuid(), ShortName = "TB", Title = "TaskBoard" };
            var created = new Board { Id = request.Id, UserId = _userId };
            _repository.GetByIdAsync(request.Id, _userId).Returns(created);

            var result = await CreateController().Create(request);

            var createdAt = Assert.IsType<CreatedAtActionResult>(result);
            Assert.Equal(nameof(BoardsController.GetById), createdAt.ActionName);
            Assert.Equal(request.Id, createdAt.RouteValues!["id"]);
            Assert.Same(created, createdAt.Value);
        }

        [Fact]
        public async Task Update_ScopesWriteToAuthenticatedUser()
        {
            var id = Guid.NewGuid();
            var request = new UpdateBoardRequest { ShortName = "TB", Title = "Renamed" };
            _repository.UpdateAsync(id, _userId, request).Returns(true);

            var result = await CreateController().Update(id, request);

            Assert.IsType<NoContentResult>(result);
            await _repository.Received(1).UpdateAsync(id, _userId, request);
        }

        [Fact]
        public async Task Update_ReturnsNotFound_WhenMissingOrNotOwned()
        {
            _repository.UpdateAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<UpdateBoardRequest>()).Returns(false);

            var result = await CreateController().Update(Guid.NewGuid(), new UpdateBoardRequest());

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
        public async Task GetShareToken_ReturnsToken_ForOwner()
        {
            var id = Guid.NewGuid();
            var token = Guid.NewGuid();
            _repository.GetShareTokenAsync(id, _userId).Returns(token);

            var result = await CreateController().GetShareToken(id);

            var ok = Assert.IsType<OkObjectResult>(result);
            Assert.Equal(token, ok.Value!.GetType().GetProperty("shareToken")!.GetValue(ok.Value));
        }

        [Fact]
        public async Task GetShareToken_ReturnsNotFound_WhenNotOwner()
        {
            _repository.GetShareTokenAsync(Arg.Any<Guid>(), Arg.Any<Guid>()).Returns((Guid?)null);

            var result = await CreateController().GetShareToken(Guid.NewGuid());

            Assert.IsType<NotFoundResult>(result);
        }

        [Fact]
        public async Task Join_ReturnsRequestedStatus_WhenNewRequester()
        {
            var token = Guid.NewGuid();
            var boardId = Guid.NewGuid();
            _repository.RequestJoinByTokenAsync(token, _userId)
                .Returns(new JoinOutcome(JoinResult.Requested, boardId));

            var result = await CreateController().Join(new JoinBoardRequest { Token = token });

            var ok = Assert.IsType<OkObjectResult>(result);
            Assert.Equal("requested", ok.Value!.GetType().GetProperty("status")!.GetValue(ok.Value));
            await _repository.Received(1).RequestJoinByTokenAsync(token, _userId);
        }

        [Fact]
        public async Task Join_ReturnsMemberStatusWithBoard_WhenAlreadyMember()
        {
            var token = Guid.NewGuid();
            var boardId = Guid.NewGuid();
            var board = new Board { Id = boardId, Role = "member" };
            _repository.RequestJoinByTokenAsync(token, _userId)
                .Returns(new JoinOutcome(JoinResult.AlreadyMember, boardId));
            _repository.GetByIdAsync(boardId, _userId).Returns(board);

            var result = await CreateController().Join(new JoinBoardRequest { Token = token });

            var ok = Assert.IsType<OkObjectResult>(result);
            Assert.Equal("member", ok.Value!.GetType().GetProperty("status")!.GetValue(ok.Value));
        }

        [Fact]
        public async Task Join_ReturnsNotFound_WhenTokenInvalid()
        {
            _repository.RequestJoinByTokenAsync(Arg.Any<Guid>(), Arg.Any<Guid>())
                .Returns(new JoinOutcome(JoinResult.NotFound, null));

            var result = await CreateController().Join(new JoinBoardRequest { Token = Guid.NewGuid() });

            Assert.IsType<NotFoundResult>(result);
        }

        [Fact]
        public async Task ApproveJoinRequest_ScopesToActingUser()
        {
            var boardId = Guid.NewGuid();
            var target = Guid.NewGuid();
            _repository.ApproveJoinRequestAsync(boardId, _userId, target).Returns(true);

            var result = await CreateController().ApproveJoinRequest(boardId, target);

            Assert.IsType<NoContentResult>(result);
            await _repository.Received(1).ApproveJoinRequestAsync(boardId, _userId, target);
        }

        [Fact]
        public async Task RejectJoinRequest_ReturnsNotFound_WhenNotPermitted()
        {
            _repository.RejectJoinRequestAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<Guid>())
                .Returns(false);

            var result = await CreateController().RejectJoinRequest(Guid.NewGuid(), Guid.NewGuid());

            Assert.IsType<NotFoundResult>(result);
        }

        [Fact]
        public async Task RemoveMember_ScopesToActingUser()
        {
            var boardId = Guid.NewGuid();
            var target = Guid.NewGuid();
            _repository.RemoveMemberAsync(boardId, _userId, target).Returns(true);

            var result = await CreateController().RemoveMember(boardId, target);

            Assert.IsType<NoContentResult>(result);
            await _repository.Received(1).RemoveMemberAsync(boardId, _userId, target);
        }

        [Fact]
        public async Task Leave_RemovesSelfFromBoard()
        {
            var boardId = Guid.NewGuid();
            _repository.RemoveMemberAsync(boardId, _userId, _userId).Returns(true);

            var result = await CreateController().Leave(boardId);

            Assert.IsType<NoContentResult>(result);
            // 退出は「自分が自分を外す」呼び出し。
            await _repository.Received(1).RemoveMemberAsync(boardId, _userId, _userId);
        }

        [Fact]
        public async Task Leave_ReturnsNotFound_WhenNotAllowed()
        {
            // オーナーは退出不可（repo が false を返す）。
            _repository.RemoveMemberAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<Guid>()).Returns(false);

            var result = await CreateController().Leave(Guid.NewGuid());

            Assert.IsType<NotFoundResult>(result);
        }

        [Fact]
        public async Task RemoveMember_ReturnsNotFound_WhenNotPermitted()
        {
            _repository.RemoveMemberAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<Guid>()).Returns(false);

            var result = await CreateController().RemoveMember(Guid.NewGuid(), Guid.NewGuid());

            Assert.IsType<NotFoundResult>(result);
        }

        [Fact]
        public async Task SetMemberRole_ScopesToActingUserAndPassesRole()
        {
            var boardId = Guid.NewGuid();
            var target = Guid.NewGuid();
            _repository.SetMemberRoleAsync(boardId, _userId, target, "owner").Returns(true);

            var result = await CreateController()
                .SetMemberRole(boardId, target, new UpdateMemberRoleRequest { Role = "owner" });

            Assert.IsType<NoContentResult>(result);
            await _repository.Received(1).SetMemberRoleAsync(boardId, _userId, target, "owner");
        }

        [Fact]
        public async Task SetMemberRole_ReturnsNotFound_WhenNotPermitted()
        {
            _repository
                .SetMemberRoleAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<string>())
                .Returns(false);

            var result = await CreateController()
                .SetMemberRole(Guid.NewGuid(), Guid.NewGuid(), new UpdateMemberRoleRequest { Role = "member" });

            Assert.IsType<NotFoundResult>(result);
        }
    }
}
