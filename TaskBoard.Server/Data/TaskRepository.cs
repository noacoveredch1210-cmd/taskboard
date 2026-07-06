using System.Data;
using Dapper;
using TaskBoard.Server.Models;

namespace TaskBoard.Server.Data
{
    public class TaskRepository : RepositoryBase, ITaskRepository
    {
        private const string Columns =
            "id, board_id AS BoardId, position_id AS PositionId, " +
            "category_id AS CategoryId, name, comment, importance, " +
            "deadline, order_index AS OrderIndex, created_at AS CreatedAt";

        public TaskRepository(IDbConnection connection) : base(connection) { }

        public async Task<IEnumerable<TaskItem>> GetByBoardIdAsync(Guid boardId)
        {
            var sql = $"""
            SELECT {Columns}
            FROM tasks
            WHERE board_id = @BoardId
            ORDER BY order_index
            """;
            return await Connection.QueryAsync<TaskItem>(sql, new { BoardId = boardId });
        }

        public async Task<TaskItem?> GetByIdAsync(Guid id)
        {
            var sql = $"""
            SELECT {Columns}
            FROM tasks
            WHERE id = @Id
            """;
            return await Connection.QuerySingleOrDefaultAsync<TaskItem>(sql, new { Id = id });
        }

        public async Task CreateAsync(CreateTaskRequest request)
        {
            const string sql = """
            INSERT INTO tasks (id, board_id, position_id, category_id, name, comment, importance, deadline, order_index)
            VALUES (@Id, @BoardId, @PositionId, @CategoryId, @Name, @Comment, @Importance, @Deadline, @OrderIndex)
            """;
            await Connection.ExecuteAsync(sql, request);
        }

        public async Task<bool> UpdateAsync(Guid id, UpdateTaskRequest request)
        {
            const string sql = """
            UPDATE tasks
            SET position_id = @PositionId,
                category_id = @CategoryId,
                name = @Name,
                comment = @Comment,
                importance = @Importance,
                deadline = @Deadline,
                order_index = @OrderIndex
            WHERE id = @Id
            """;
            var affectedRows = await Connection.ExecuteAsync(sql, new
            {
                Id = id,
                request.PositionId,
                request.CategoryId,
                request.Name,
                request.Comment,
                request.Importance,
                request.Deadline,
                request.OrderIndex
            });
            return affectedRows > 0;
        }

        public Task<bool> DeleteAsync(Guid id) => DeleteByIdAsync("tasks", id);
    }
}
