using System.Data;
using Dapper;
using TaskBoard.Server.Models;

namespace TaskBoard.Server.Data
{
    public class CategoryRepository : ICategoryRepository
    {
        private readonly IDbConnection _connection;

        public CategoryRepository(IDbConnection connection)
        {
            _connection = connection;
        }

        public async Task<IEnumerable<Category>> GetByUserIdAsync(Guid userId)
        {
            const string sql = """
            SELECT id, user_id AS UserId, name, color, created_at AS CreatedAt
            FROM categories
            WHERE user_id = @UserId
            ORDER BY created_at
            """;
            return await _connection.QueryAsync<Category>(sql, new { UserId = userId });
        }

        public async Task<Category?> GetByIdAsync(Guid id)
        {
            const string sql = """
            SELECT id, user_id AS UserId, name, color, created_at AS CreatedAt
            FROM categories
            WHERE id = @Id
            """;
            return await _connection.QuerySingleOrDefaultAsync<Category>(sql, new { Id = id });
        }

        public async Task CreateAsync(CreateCategoryRequest request)
        {
            const string sql = """
            INSERT INTO categories (id, user_id, name, color)
            VALUES (@Id, @UserId, @Name, @Color)
            """;
            await _connection.ExecuteAsync(sql, request);
        }

        public async Task<bool> UpdateAsync(Guid id, UpdateCategoryRequest request)
        {
            const string sql = """
            UPDATE categories
            SET name = @Name,
                color = @Color
            WHERE id = @Id
            """;
            var affectedRows = await _connection.ExecuteAsync(sql, new
            {
                Id = id,
                request.Name,
                request.Color
            });
            return affectedRows > 0;
        }

        public async Task<bool> DeleteAsync(Guid id)
        {
            const string sql = "DELETE FROM categories WHERE id = @Id";
            var affectedRows = await _connection.ExecuteAsync(sql, new { Id = id });
            return affectedRows > 0;
        }
    }
}