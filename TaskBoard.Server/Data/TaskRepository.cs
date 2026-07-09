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

        /// <summary>tasks の行が、認証ユーザーの所有する board に属することを要求する条件。</summary>
        private const string OwnedByUser =
            "EXISTS (SELECT 1 FROM boards b WHERE b.id = tasks.board_id AND b.user_id = @UserId)";

        public TaskRepository(IDbConnection connection) : base(connection) { }

        public async Task<IEnumerable<TaskItem>> GetByBoardIdAsync(Guid boardId, Guid userId)
        {
            var sql = $"""
            SELECT {Columns}
            FROM tasks
            WHERE board_id = @BoardId AND {OwnedByUser}
            ORDER BY order_index
            """;
            return await Connection.QueryAsync<TaskItem>(sql, new { BoardId = boardId, UserId = userId });
        }

        public async Task<TaskItem?> GetByIdAsync(Guid id, Guid userId)
        {
            var sql = $"""
            SELECT {Columns}
            FROM tasks
            WHERE id = @Id AND {OwnedByUser}
            """;
            return await Connection.QuerySingleOrDefaultAsync<TaskItem>(sql, new { Id = id, UserId = userId });
        }

        public async Task<bool> CreateAsync(CreateTaskRequest request, Guid userId)
        {
            if (!await OwnsBoardAsync(request.BoardId, userId)) return false;
            if (!await CanAssignAsync(request.BoardId, userId, request.PositionId, request.CategoryId)) return false;

            const string sql = """
            INSERT INTO tasks (id, board_id, position_id, category_id, name, comment, importance, deadline, order_index)
            VALUES (@Id, @BoardId, @PositionId, @CategoryId, @Name, @Comment, @Importance, @Deadline, @OrderIndex)
            """;
            await Connection.ExecuteAsync(sql, request);
            return true;
        }

        public async Task<bool> UpdateAsync(Guid id, Guid userId, UpdateTaskRequest request)
        {
            // 所有権の確認と、移動先 board の特定を兼ねる。
            var boardId = await FindOwnedBoardIdAsync(id, userId);
            if (boardId is null) return false;
            if (!await CanAssignAsync(boardId.Value, userId, request.PositionId, request.CategoryId)) return false;

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

        public async Task<bool> DeleteAsync(Guid id, Guid userId)
        {
            var sql = $"""
            DELETE FROM tasks
            WHERE id = @Id AND {OwnedByUser}
            """;
            var affectedRows = await Connection.ExecuteAsync(sql, new { Id = id, UserId = userId });
            return affectedRows > 0;
        }

        /// <summary>task が認証ユーザーの board に属していれば、その board_id を返す。</summary>
        private Task<Guid?> FindOwnedBoardIdAsync(Guid id, Guid userId)
        {
            const string sql = """
            SELECT t.board_id
            FROM tasks t
            JOIN boards b ON b.id = t.board_id
            WHERE t.id = @Id AND b.user_id = @UserId
            """;
            return Connection.ExecuteScalarAsync<Guid?>(sql, new { Id = id, UserId = userId });
        }

        /// <summary>
        /// 割り当て先の妥当性を確認する。position は同一 board 内、category は同一ユーザーのものに限る
        /// （他人のカテゴリーや別 board のポジションを task に紐付けさせない）。
        /// </summary>
        private async Task<bool> CanAssignAsync(Guid boardId, Guid userId, Guid? positionId, Guid? categoryId)
        {
            if (positionId is Guid position)
            {
                const string sql = "SELECT EXISTS (SELECT 1 FROM positions WHERE id = @Id AND board_id = @BoardId)";
                if (!await Connection.ExecuteScalarAsync<bool>(sql, new { Id = position, BoardId = boardId }))
                    return false;
            }

            if (categoryId is Guid category)
            {
                const string sql = "SELECT EXISTS (SELECT 1 FROM categories WHERE id = @Id AND user_id = @UserId)";
                if (!await Connection.ExecuteScalarAsync<bool>(sql, new { Id = category, UserId = userId }))
                    return false;
            }

            return true;
        }
    }
}
