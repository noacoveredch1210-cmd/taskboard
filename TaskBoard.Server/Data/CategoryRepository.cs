using System.Data;
using Dapper;
using TaskBoard.Server.Models;

namespace TaskBoard.Server.Data
{
    public class CategoryRepository : RepositoryBase, ICategoryRepository
    {
        private const string Columns =
            "id, board_id AS BoardId, name, color, created_at AS CreatedAt";

        /// <summary>categories の行が、認証ユーザーの参加する board に属することを要求する条件。</summary>
        private const string OwnedByUser =
            "EXISTS (SELECT 1 FROM board_members m WHERE m.board_id = categories.board_id AND m.user_id = @UserId)";

        public CategoryRepository(IDbConnection connection) : base(connection) { }

        public async Task<IEnumerable<Category>> GetByBoardIdAsync(Guid boardId, Guid userId)
        {
            var sql = $"""
            SELECT {Columns}
            FROM categories
            WHERE board_id = @BoardId AND {OwnedByUser}
            ORDER BY created_at
            """;
            return await Connection.QueryAsync<Category>(sql, new { BoardId = boardId, UserId = userId });
        }

        public async Task<Category?> GetByIdAsync(Guid id, Guid userId)
        {
            var sql = $"""
            SELECT {Columns}
            FROM categories
            WHERE id = @Id AND {OwnedByUser}
            """;
            return await Connection.QuerySingleOrDefaultAsync<Category>(sql, new { Id = id, UserId = userId });
        }

        public async Task<bool> CreateAsync(CreateCategoryRequest request, Guid userId)
        {
            if (!await IsBoardMemberAsync(request.BoardId, userId)) return false;

            const string sql = """
            INSERT INTO categories (id, board_id, name, color)
            VALUES (@Id, @BoardId, @Name, @Color)
            """;
            await Connection.ExecuteAsync(sql, request);
            return true;
        }

        public async Task<bool> UpdateAsync(Guid id, Guid userId, UpdateCategoryRequest request)
        {
            var sql = $"""
            UPDATE categories
            SET name = @Name,
                color = @Color
            WHERE id = @Id AND {OwnedByUser}
            """;
            var affectedRows = await Connection.ExecuteAsync(sql, new
            {
                Id = id,
                UserId = userId,
                request.Name,
                request.Color
            });
            return affectedRows > 0;
        }

        public async Task<bool> DeleteAsync(Guid id, Guid userId)
        {
            var sql = $"""
            DELETE FROM categories
            WHERE id = @Id AND {OwnedByUser}
            """;
            var affectedRows = await Connection.ExecuteAsync(sql, new { Id = id, UserId = userId });
            return affectedRows > 0;
        }
    }
}
