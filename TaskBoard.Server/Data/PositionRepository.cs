using System.Data;
using Dapper;
using TaskBoard.Server.Models;

namespace TaskBoard.Server.Data
{
    public class PositionRepository : RepositoryBase, IPositionRepository
    {
        private const string Columns =
            "id, board_id AS BoardId, name, order_index AS OrderIndex, created_at AS CreatedAt";

        /// <summary>positions の行が、認証ユーザーの所有する board に属することを要求する条件。</summary>
        private const string OwnedByUser =
            "EXISTS (SELECT 1 FROM boards b WHERE b.id = positions.board_id AND b.user_id = @UserId)";

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
            if (!await OwnsBoardAsync(request.BoardId, userId)) return false;

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
            WHERE id = @Id AND {OwnedByUser}
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
            WHERE id = @Id AND {OwnedByUser}
            """;
            var affectedRows = await Connection.ExecuteAsync(sql, new { Id = id, UserId = userId });
            return affectedRows > 0;
        }
    }
}
