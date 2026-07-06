using System.Data;
using Dapper;
using TaskBoard.Server.Models;

namespace TaskBoard.Server.Data
{
    public class BoardRepository : IBoardRepository
    {
        private readonly IDbConnection _connection;

        public BoardRepository(IDbConnection connection)
        {
            _connection = connection;
        }

        public async Task<IEnumerable<Board>> GetByUserIdAsync(Guid userId)
        {
            const string sql = """
            SELECT id, user_id AS UserId, short_name AS ShortName,
                   title, created_at AS CreatedAt
            FROM boards
            WHERE user_id = @UserId
            ORDER BY created_at
            """;
            return await _connection.QueryAsync<Board>(sql, new { UserId = userId });
        }

        public async Task<Board?> GetByIdAsync(Guid id)
        {
            const string sql = """
            SELECT id, user_id AS UserId, short_name AS ShortName,
                   title, created_at AS CreatedAt
            FROM boards
            WHERE id = @Id
            """;
            return await _connection.QuerySingleOrDefaultAsync<Board>(sql, new { Id = id });
        }

        public async Task CreateAsync(CreateBoardRequest request)
        {
            const string sql = """
            INSERT INTO boards (id, user_id, short_name, title)
            VALUES (@Id, @UserId, @ShortName, @Title)
            """;
            await _connection.ExecuteAsync(sql, request);
        }

        public async Task<bool> UpdateAsync(Guid id, UpdateBoardRequest request)
        {
            const string sql = """
            UPDATE boards
            SET short_name = @ShortName,
                title = @Title
            WHERE id = @Id
            """;
            var affectedRows = await _connection.ExecuteAsync(sql, new
            {
                Id = id,
                request.ShortName,
                request.Title
            });
            return affectedRows > 0;
        }

        public async Task<bool> DeleteAsync(Guid id)
        {
            const string sql = "DELETE FROM boards WHERE id = @Id";
            var affectedRows = await _connection.ExecuteAsync(sql, new { Id = id });
            return affectedRows > 0;
        }
    }
}