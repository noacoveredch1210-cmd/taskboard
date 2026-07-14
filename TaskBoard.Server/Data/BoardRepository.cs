using System.Data;
using Dapper;
using TaskBoard.Server.Models;

namespace TaskBoard.Server.Data
{
    public class BoardRepository : RepositoryBase, IBoardRepository
    {
        public BoardRepository(IDbConnection connection) : base(connection) { }

        public async Task<IEnumerable<Board>> GetForUserAsync(Guid userId)
        {
            // 参加しているボードだけを、自分の役割付きで返す。
            const string sql = """
            SELECT b.id, b.user_id AS UserId, b.short_name AS ShortName, b.title, m.role AS Role, b.created_at AS CreatedAt
            FROM boards b
            JOIN board_members m ON m.board_id = b.id
            WHERE m.user_id = @UserId
            ORDER BY b.created_at
            """;
            return await Connection.QueryAsync<Board>(sql, new { UserId = userId });
        }

        public async Task<Board?> GetByIdAsync(Guid id, Guid userId)
        {
            const string sql = """
            SELECT b.id, b.user_id AS UserId, b.short_name AS ShortName, b.title, m.role AS Role, b.created_at AS CreatedAt
            FROM boards b
            JOIN board_members m ON m.board_id = b.id AND m.user_id = @UserId
            WHERE b.id = @Id
            """;
            return await Connection.QuerySingleOrDefaultAsync<Board>(sql, new { Id = id, UserId = userId });
        }

        public async Task CreateAsync(CreateBoardRequest request)
        {
            // board を作り、作成者を owner としてメンバー登録する。
            const string insertBoard = """
            INSERT INTO boards (id, user_id, short_name, title)
            VALUES (@Id, @UserId, @ShortName, @Title)
            """;
            await Connection.ExecuteAsync(insertBoard, request);

            const string insertOwner = """
            INSERT INTO board_members (board_id, user_id, role)
            VALUES (@BoardId, @UserId, 'owner')
            """;
            await Connection.ExecuteAsync(insertOwner, new { BoardId = request.Id, request.UserId });
        }

        public async Task<bool> UpdateAsync(Guid id, Guid userId, UpdateBoardRequest request)
        {
            // ボードの編集（タイトル・略称）はオーナーのみ。
            const string sql = """
            UPDATE boards
            SET short_name = @ShortName,
                title = @Title
            WHERE id = @Id
              AND EXISTS (SELECT 1 FROM board_members m WHERE m.board_id = boards.id AND m.user_id = @UserId AND m.role = 'owner')
            """;
            var affectedRows = await Connection.ExecuteAsync(sql, new
            {
                Id = id,
                UserId = userId,
                request.ShortName,
                request.Title
            });
            return affectedRows > 0;
        }

        public async Task<bool> DeleteAsync(Guid id, Guid userId)
        {
            // 削除はオーナーだけ。
            const string sql = """
            DELETE FROM boards
            WHERE id = @Id
              AND EXISTS (SELECT 1 FROM board_members m
                          WHERE m.board_id = boards.id AND m.user_id = @UserId AND m.role = 'owner')
            """;
            var affectedRows = await Connection.ExecuteAsync(sql, new { Id = id, UserId = userId });
            return affectedRows > 0;
        }

        public async Task<Guid?> GetShareTokenAsync(Guid boardId, Guid userId)
        {
            if (!await IsBoardOwnerAsync(boardId, userId)) return null;

            const string sql = "SELECT share_token FROM boards WHERE id = @Id";
            return await Connection.ExecuteScalarAsync<Guid?>(sql, new { Id = boardId });
        }

        public async Task<JoinOutcome> RequestJoinByTokenAsync(Guid token, Guid userId)
        {
            var boardId = await Connection.ExecuteScalarAsync<Guid?>(
                "SELECT id FROM boards WHERE share_token = @Token", new { Token = token });
            if (boardId is null) return new JoinOutcome(JoinResult.NotFound, null);

            if (await IsBoardMemberAsync(boardId.Value, userId))
                return new JoinOutcome(JoinResult.AlreadyMember, boardId);

            // 即メンバーにはせず、保留リクエストとして積む（オーナーの承認待ち）。
            await Connection.ExecuteAsync("""
                INSERT INTO board_join_requests (board_id, user_id)
                VALUES (@BoardId, @UserId)
                ON CONFLICT (board_id, user_id) DO NOTHING
                """, new { BoardId = boardId, UserId = userId });

            return new JoinOutcome(JoinResult.Requested, boardId);
        }

        public async Task<IEnumerable<BoardMember>> GetJoinRequestsAsync(Guid boardId, Guid userId)
        {
            if (!await IsBoardOwnerAsync(boardId, userId)) return [];

            const string sql = """
            SELECT u.id AS UserId, u.name, u.email, '' AS Role
            FROM board_join_requests r
            JOIN users u ON u.id = r.user_id
            WHERE r.board_id = @BoardId
            ORDER BY r.created_at
            """;
            return await Connection.QueryAsync<BoardMember>(sql, new { BoardId = boardId });
        }

        public async Task<bool> ApproveJoinRequestAsync(Guid boardId, Guid actingUserId, Guid targetUserId)
        {
            if (!await IsBoardOwnerAsync(boardId, actingUserId)) return false;

            // リクエストが無ければ承認しない。
            var deleted = await Connection.ExecuteAsync(
                "DELETE FROM board_join_requests WHERE board_id = @BoardId AND user_id = @TargetUserId",
                new { BoardId = boardId, TargetUserId = targetUserId });
            if (deleted == 0) return false;

            await Connection.ExecuteAsync("""
                INSERT INTO board_members (board_id, user_id, role)
                VALUES (@BoardId, @TargetUserId, 'member')
                ON CONFLICT (board_id, user_id) DO NOTHING
                """, new { BoardId = boardId, TargetUserId = targetUserId });
            return true;
        }

        public async Task<bool> RejectJoinRequestAsync(Guid boardId, Guid actingUserId, Guid targetUserId)
        {
            if (!await IsBoardOwnerAsync(boardId, actingUserId)) return false;

            var affectedRows = await Connection.ExecuteAsync(
                "DELETE FROM board_join_requests WHERE board_id = @BoardId AND user_id = @TargetUserId",
                new { BoardId = boardId, TargetUserId = targetUserId });
            return affectedRows > 0;
        }

        public async Task<IEnumerable<BoardMember>> GetMembersAsync(Guid boardId, Guid userId)
        {
            if (!await IsBoardMemberAsync(boardId, userId)) return [];

            const string sql = """
            SELECT u.id AS UserId, u.name, u.email, m.role
            FROM board_members m
            JOIN users u ON u.id = m.user_id
            WHERE m.board_id = @BoardId
            ORDER BY m.created_at
            """;
            return await Connection.QueryAsync<BoardMember>(sql, new { BoardId = boardId });
        }

        public async Task<bool> RemoveMemberAsync(Guid boardId, Guid actingUserId, Guid targetUserId)
        {
            // 本人の退出は常に可。他人を外すのはオーナーのみ。
            var self = actingUserId == targetUserId;
            if (!self && !await IsBoardOwnerAsync(boardId, actingUserId)) return false;

            // オーナー行は外せない（ボードを消したいならオーナーが board を削除する）。
            const string sql = """
            DELETE FROM board_members
            WHERE board_id = @BoardId AND user_id = @TargetUserId AND role <> 'owner'
            """;
            var affectedRows = await Connection.ExecuteAsync(sql,
                new { BoardId = boardId, TargetUserId = targetUserId });
            return affectedRows > 0;
        }

        public async Task<bool> SetMemberRoleAsync(
            Guid boardId, Guid actingUserId, Guid targetUserId, string role)
        {
            // 役割変更はオーナーのみ。
            if (!await IsBoardOwnerAsync(boardId, actingUserId)) return false;

            // 最後の 1 人のオーナーを降格させない（ボードが管理不能になるのを防ぐ）。
            if (role == "member")
            {
                const string countSql =
                    "SELECT COUNT(*) FROM board_members WHERE board_id = @BoardId AND role = 'owner'";
                var ownerCount = await Connection.ExecuteScalarAsync<int>(countSql, new { BoardId = boardId });

                const string targetSql =
                    "SELECT EXISTS (SELECT 1 FROM board_members WHERE board_id = @BoardId AND user_id = @TargetUserId AND role = 'owner')";
                var targetIsOwner = await Connection.ExecuteScalarAsync<bool>(
                    targetSql, new { BoardId = boardId, TargetUserId = targetUserId });

                if (targetIsOwner && ownerCount <= 1) return false;
            }

            const string sql = """
            UPDATE board_members SET role = @Role
            WHERE board_id = @BoardId AND user_id = @TargetUserId
            """;
            var affectedRows = await Connection.ExecuteAsync(sql,
                new { BoardId = boardId, TargetUserId = targetUserId, Role = role });
            return affectedRows > 0;
        }
    }
}
