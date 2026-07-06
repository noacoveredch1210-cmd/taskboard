using System.Data;
using Dapper;
using TaskBoard.Server.Models;

namespace TaskBoard.Server.Data
{
    public class PositionRepository : IPositionRepository
    {
        private readonly IDbConnection _connection;

        public PositionRepository(IDbConnection connection)
        {
            _connection = connection;
        }

        public async Task<IEnumerable<Position>> GetByBoardIdAsync(Guid boardId)
        {
            const string sql = """
            SELECT id, board_id AS BoardId, name, created_at AS CreatedAt
            FROM positions
            WHERE board_id = @BoardId
            ORDER BY created_at
            """;
            return await _connection.QueryAsync<Position>(sql, new { BoardId = boardId });
        }

        public async Task<Position?> GetByIdAsync(Guid id)
        {
            const string sql = """
            SELECT id, board_id AS BoardId, name, created_at AS CreatedAt
            FROM positions
            WHERE id = @Id
            """;
            return await _connection.QuerySingleOrDefaultAsync<Position>(sql, new { Id = id });
        }

        public async Task CreateAsync(CreatePositionRequest request)
        {
            const string sql = """
            INSERT INTO positions (id, board_id, name)
            VALUES (@Id, @BoardId, @Name)
            """;
            await _connection.ExecuteAsync(sql, request);
        }

        public async Task<bool> UpdateAsync(Guid id, UpdatePositionRequest request)
        {
            const string sql = """
            UPDATE positions
            SET name = @Name
            WHERE id = @Id
            """;
            var affectedRows = await _connection.ExecuteAsync(sql, new { Id = id, request.Name });
            return affectedRows > 0;
        }

        public async Task<bool> DeleteAsync(Guid id)
        {
            const string sql = "DELETE FROM positions WHERE id = @Id";
            var affectedRows = await _connection.ExecuteAsync(sql, new { Id = id });
            return affectedRows > 0;
        }
    }
}