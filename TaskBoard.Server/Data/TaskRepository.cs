using System.Data;
using Dapper;
using TaskBoard.Server.Models;

namespace TaskBoard.Server.Data;

public class TaskRepository : ITaskRepository
{
    private readonly IDbConnection _connection;

    public TaskRepository(IDbConnection connection)
    {
        _connection = connection;
    }

    public async Task<IEnumerable<TaskItem>> GetByBoardIdAsync(Guid boardId)
    {
        const string sql = """
            SELECT id, board_id AS BoardId, position_id AS PositionId,
                   category_id AS CategoryId, name, comment, importance,
                   deadline, created_at AS CreatedAt
            FROM tasks
            WHERE board_id = @BoardId
            ORDER BY created_at
            """;
        return await _connection.QueryAsync<TaskItem>(sql, new { BoardId = boardId });
    }

    public async Task<TaskItem?> GetByIdAsync(Guid id)
    {
        const string sql = """
            SELECT id, board_id AS BoardId, position_id AS PositionId,
                   category_id AS CategoryId, name, comment, importance,
                   deadline, created_at AS CreatedAt
            FROM tasks
            WHERE id = @Id
            """;
        return await _connection.QuerySingleOrDefaultAsync<TaskItem>(sql, new { Id = id });
    }

    public async Task CreateAsync(CreateTaskRequest request)
    {
        const string sql = """
            INSERT INTO tasks (id, board_id, position_id, category_id, name, comment, importance, deadline)
            VALUES (@Id, @BoardId, @PositionId, @CategoryId, @Name, @Comment, @Importance, @Deadline)
            """;
        await _connection.ExecuteAsync(sql, request);
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
                deadline = @Deadline
            WHERE id = @Id
            """;
        var affectedRows = await _connection.ExecuteAsync(sql, new
        {
            Id = id,
            request.PositionId,
            request.CategoryId,
            request.Name,
            request.Comment,
            request.Importance,
            request.Deadline
        });
        return affectedRows > 0;
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        const string sql = "DELETE FROM tasks WHERE id = @Id";
        var affectedRows = await _connection.ExecuteAsync(sql, new { Id = id });
        return affectedRows > 0;
    }
}