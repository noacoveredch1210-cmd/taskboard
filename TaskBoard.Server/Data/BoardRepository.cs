using System.Data;
using Dapper;
using TaskBoard.Server.Models;

namespace TaskBoard.Server.Data
{
    public class BoardRepository : RepositoryBase, IBoardRepository
    {
        private const string Columns =
            "id, user_id AS UserId, short_name AS ShortName, title, created_at AS CreatedAt";

        public BoardRepository(IDbConnection connection) : base(connection) { }

        public async Task<IEnumerable<Board>> GetByUserIdAsync(Guid userId)
        {
            var sql = $"""
            SELECT {Columns}
            FROM boards
            WHERE user_id = @UserId
            ORDER BY created_at
            """;
            return await Connection.QueryAsync<Board>(sql, new { UserId = userId });
        }

        public async Task<Board?> GetByIdAsync(Guid id, Guid userId)
        {
            var sql = $"""
            SELECT {Columns}
            FROM boards
            WHERE id = @Id AND user_id = @UserId
            """;
            return await Connection.QuerySingleOrDefaultAsync<Board>(sql, new { Id = id, UserId = userId });
        }

        public async Task CreateAsync(CreateBoardRequest request)
        {
            const string sql = """
            INSERT INTO boards (id, user_id, short_name, title)
            VALUES (@Id, @UserId, @ShortName, @Title)
            """;
            await Connection.ExecuteAsync(sql, request);
        }

        public async Task<bool> UpdateAsync(Guid id, Guid userId, UpdateBoardRequest request)
        {
            const string sql = """
            UPDATE boards
            SET short_name = @ShortName,
                title = @Title
            WHERE id = @Id AND user_id = @UserId
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

        public Task<bool> DeleteAsync(Guid id, Guid userId) => DeleteOwnedAsync("boards", id, userId);
    }
}
