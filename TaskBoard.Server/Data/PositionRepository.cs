using System.Data;
using Dapper;
using TaskBoard.Server.Models;

namespace TaskBoard.Server.Data
{
    public class PositionRepository : RepositoryBase, IPositionRepository
    {
        private const string Columns =
            "id, board_id AS BoardId, name, order_index AS OrderIndex, created_at AS CreatedAt";

        public PositionRepository(IDbConnection connection) : base(connection) { }

        public async Task<IEnumerable<Position>> GetByBoardIdAsync(Guid boardId)
        {
            var sql = $"""
            SELECT {Columns}
            FROM positions
            WHERE board_id = @BoardId
            ORDER BY order_index
            """;
            return await Connection.QueryAsync<Position>(sql, new { BoardId = boardId });
        }

        public async Task<Position?> GetByIdAsync(Guid id)
        {
            var sql = $"""
            SELECT {Columns}
            FROM positions
            WHERE id = @Id
            """;
            return await Connection.QuerySingleOrDefaultAsync<Position>(sql, new { Id = id });
        }

        public async Task CreateAsync(CreatePositionRequest request)
        {
            const string sql = """
            INSERT INTO positions (id, board_id, name, order_index)
            VALUES (@Id, @BoardId, @Name, @OrderIndex)
            """;
            await Connection.ExecuteAsync(sql, request);
        }

        public async Task<bool> UpdateAsync(Guid id, UpdatePositionRequest request)
        {
            const string sql = """
            UPDATE positions
            SET name = @Name,
                order_index = @OrderIndex
            WHERE id = @Id
            """;
            var affectedRows = await Connection.ExecuteAsync(sql, new { Id = id, request.Name, request.OrderIndex });
            return affectedRows > 0;
        }

        public Task<bool> DeleteAsync(Guid id) => DeleteByIdAsync("positions", id);
    }
}
