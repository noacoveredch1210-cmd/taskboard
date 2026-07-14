using System.Data;
using Dapper;
using TaskBoard.Server.Models;

namespace TaskBoard.Server.Data
{
    public class PositionRepository : RepositoryBase, IPositionRepository
    {
        private const string Columns =
            "id, board_id AS BoardId, name, order_index AS OrderIndex, created_at AS CreatedAt";

        /// <summary>positions の行が、認証ユーザーの参加する board に属すること（閲覧用）。</summary>
        private const string OwnedByUser =
            "EXISTS (SELECT 1 FROM board_members m WHERE m.board_id = positions.board_id AND m.user_id = @UserId)";

        /// <summary>列の追加・改名・並べ替え・削除はボード構造の変更なのでオーナー限定。</summary>
        private const string OwnedByOwner =
            "EXISTS (SELECT 1 FROM board_members m WHERE m.board_id = positions.board_id AND m.user_id = @UserId AND m.role = 'owner')";

        public PositionRepository(IDbConnection connection) : base(connection) { }

        public async Task<IEnumerable<Position>> GetByBoardIdAsync(Guid boardId, Guid userId)
        {
            var sql = $"""
            SELECT {Columns}
            FROM positions
            WHERE board_id = @BoardId AND {OwnedByUser}
            ORDER BY order_index
            """;
            return await Connection.QueryAsync<Position>(sql, new { BoardId = boardId, UserId = userId });
        }

        public async Task<Position?> GetByIdAsync(Guid id, Guid userId)
        {
            var sql = $"""
            SELECT {Columns}
            FROM positions
            WHERE id = @Id AND {OwnedByUser}
            """;
            return await Connection.QuerySingleOrDefaultAsync<Position>(sql, new { Id = id, UserId = userId });
        }

        public async Task<bool> CreateAsync(CreatePositionRequest request, Guid userId)
        {
            // 列の作成はオーナーのみ（ボード構造の変更）。
            if (!await IsBoardOwnerAsync(request.BoardId, userId)) return false;

            const string sql = """
            INSERT INTO positions (id, board_id, name, order_index)
            VALUES (@Id, @BoardId, @Name, @OrderIndex)
            """;
            await Connection.ExecuteAsync(sql, request);
            return true;
        }

        public async Task<bool> UpdateAsync(Guid id, Guid userId, UpdatePositionRequest request)
        {
            var sql = $"""
            UPDATE positions
            SET name = @Name,
                order_index = @OrderIndex
            WHERE id = @Id AND {OwnedByOwner}
            """;
            var affectedRows = await Connection.ExecuteAsync(sql, new
            {
                Id = id,
                UserId = userId,
                request.Name,
                request.OrderIndex
            });
            return affectedRows > 0;
        }

        public async Task<bool> DeleteAsync(Guid id, Guid userId)
        {
            var sql = $"""
            DELETE FROM positions
            WHERE id = @Id AND {OwnedByOwner}
            """;
            var affectedRows = await Connection.ExecuteAsync(sql, new { Id = id, UserId = userId });
            return affectedRows > 0;
        }
    }
}
