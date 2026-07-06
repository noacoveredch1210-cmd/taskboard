using System.Data;
using Dapper;
using TaskBoard.Server.Models;

namespace TaskBoard.Server.Data
{
    public class CategoryRepository : RepositoryBase, ICategoryRepository
    {
        private const string Columns =
            "id, user_id AS UserId, name, color, created_at AS CreatedAt";

        public CategoryRepository(IDbConnection connection) : base(connection) { }

        public async Task<IEnumerable<Category>> GetByUserIdAsync(Guid userId)
        {
            var sql = $"""
            SELECT {Columns}
            FROM categories
            WHERE user_id = @UserId
            ORDER BY created_at
            """;
            return await Connection.QueryAsync<Category>(sql, new { UserId = userId });
        }

        public async Task<Category?> GetByIdAsync(Guid id)
        {
            var sql = $"""
            SELECT {Columns}
            FROM categories
            WHERE id = @Id
            """;
            return await Connection.QuerySingleOrDefaultAsync<Category>(sql, new { Id = id });
        }

        public async Task CreateAsync(CreateCategoryRequest request)
        {
            const string sql = """
            INSERT INTO categories (id, user_id, name, color)
            VALUES (@Id, @UserId, @Name, @Color)
            """;
            await Connection.ExecuteAsync(sql, request);
        }

        public async Task<bool> UpdateAsync(Guid id, UpdateCategoryRequest request)
        {
            const string sql = """
            UPDATE categories
            SET name = @Name,
                color = @Color
            WHERE id = @Id
            """;
            var affectedRows = await Connection.ExecuteAsync(sql, new
            {
                Id = id,
                request.Name,
                request.Color
            });
            return affectedRows > 0;
        }

        public Task<bool> DeleteAsync(Guid id) => DeleteByIdAsync("categories", id);
    }
}
