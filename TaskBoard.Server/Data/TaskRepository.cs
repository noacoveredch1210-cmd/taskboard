using System.Data;
using Dapper;
using TaskBoard.Server.Models;

namespace TaskBoard.Server.Data
{
    public class TaskRepository : RepositoryBase, ITaskRepository
    {
        private const string Columns =
            "id, board_id AS BoardId, position_id AS PositionId, " +
            "category_id AS CategoryId, assignee_id AS AssigneeId, name, comment, importance, " +
            "deadline, order_index AS OrderIndex, created_at AS CreatedAt";

        /// <summary>tasks の行が、認証ユーザーの参加する board に属することを要求する条件（閲覧・編集用）。</summary>
        private const string OwnedByUser =
            "EXISTS (SELECT 1 FROM board_members m WHERE m.board_id = tasks.board_id AND m.user_id = @UserId)";

        /// <summary>削除・復元・完全削除・ゴミ箱閲覧はオーナー限定。</summary>
        private const string OwnedByOwner =
            "EXISTS (SELECT 1 FROM board_members m WHERE m.board_id = tasks.board_id AND m.user_id = @UserId AND m.role = 'owner')";

        public TaskRepository(IDbConnection connection) : base(connection) { }

        public async Task<IEnumerable<TaskItem>> GetByBoardIdAsync(Guid boardId, Guid userId)
        {
            // 通常の一覧はゴミ箱（deleted_at 非 NULL）を除く。
            var sql = $"""
            SELECT {Columns}
            FROM tasks
            WHERE board_id = @BoardId AND deleted_at IS NULL AND {OwnedByUser}
            ORDER BY order_index
            """;
            return await Connection.QueryAsync<TaskItem>(sql, new { BoardId = boardId, UserId = userId });
        }

        public async Task<TaskItem?> GetByIdAsync(Guid id, Guid userId)
        {
            var sql = $"""
            SELECT {Columns}
            FROM tasks
            WHERE id = @Id AND deleted_at IS NULL AND {OwnedByUser}
            """;
            return await Connection.QuerySingleOrDefaultAsync<TaskItem>(sql, new { Id = id, UserId = userId });
        }

        /// <summary>ゴミ箱（削除済み）のタスク一覧。オーナーのみ。</summary>
        public async Task<IEnumerable<TaskItem>> GetTrashByBoardIdAsync(Guid boardId, Guid userId)
        {
            if (!await IsBoardOwnerAsync(boardId, userId)) return [];

            var sql = $"""
            SELECT {Columns}
            FROM tasks
            WHERE board_id = @BoardId AND deleted_at IS NOT NULL
            ORDER BY deleted_at DESC
            """;
            return await Connection.QueryAsync<TaskItem>(sql, new { BoardId = boardId });
        }

        public async Task<bool> CreateAsync(CreateTaskRequest request, Guid userId)
        {
            if (!await IsBoardMemberAsync(request.BoardId, userId)) return false;
            if (!await CanAssignAsync(request.BoardId, request.PositionId, request.CategoryId, request.AssigneeId)) return false;

            // 新規タスクはそのカラムの先頭へ。order_index はクライアントから受け取らず、
            // 現在の最小値 - 1 を DB 側で決める（読み取りと挿入を 1 文にして競合を避ける）。
            const string sql = """
            INSERT INTO tasks (id, board_id, position_id, category_id, assignee_id, name, comment, importance, deadline, order_index)
            VALUES (@Id, @BoardId, @PositionId, @CategoryId, @AssigneeId, @Name, @Comment, @Importance, @Deadline,
              (SELECT COALESCE(MIN(order_index), 1) - 1 FROM tasks
               WHERE board_id = @BoardId
                 AND position_id IS NOT DISTINCT FROM @PositionId
                 AND deleted_at IS NULL))
            """;
            await Connection.ExecuteAsync(sql, request);
            return true;
        }

        public async Task<bool> UpdateAsync(Guid id, Guid userId, UpdateTaskRequest request)
        {
            // 所有権の確認と、移動先 board の特定を兼ねる。
            var boardId = await FindOwnedBoardIdAsync(id, userId);
            if (boardId is null) return false;
            if (!await CanAssignAsync(boardId.Value, request.PositionId, request.CategoryId, request.AssigneeId)) return false;

            const string sql = """
            UPDATE tasks
            SET position_id = @PositionId,
                category_id = @CategoryId,
                assignee_id = @AssigneeId,
                name = @Name,
                comment = @Comment,
                importance = @Importance,
                deadline = @Deadline
            WHERE id = @Id
            """;
            var affectedRows = await Connection.ExecuteAsync(sql, new
            {
                Id = id,
                request.PositionId,
                request.CategoryId,
                request.AssigneeId,
                request.Name,
                request.Comment,
                request.Importance,
                request.Deadline
            });
            return affectedRows > 0;
        }

        /// <summary>
        /// タスクを移動する。order_index はクライアントから受け取らず、ここで採番する。
        ///
        /// 「両隣の中間値」を取り、精度が枯渇して中間値を作れないときだけ、そのカラムを
        /// 0,1,2,… に振り直す。読み取り・採番・振り直しを 1 つのトランザクションに入れるのは、
        /// 振り直しが複数行の UPDATE になるため。途中で失敗すると一部の行だけ新しい連番、
        /// 残りが古い密集値のまま残り、並び順そのものが壊れる（例: 0.5, 1, 0.5000000000000002 で
        /// 順序が入れ替わる）。1 トランザクションなら全部成功か全部無かったことになる。
        /// 隣接タスクの値も、送られてきた値ではなくこの中で読み直す（他の人が動かしている可能性がある）。
        /// </summary>
        public async Task<bool> MoveAsync(Guid id, Guid userId, MoveTaskRequest request)
        {
            var boardId = await FindOwnedBoardIdAsync(id, userId);
            if (boardId is null) return false;
            if (!await CanAssignAsync(boardId.Value, request.PositionId, null)) return false;

            // 隣に指定されたタスクは、移動先と同じカラムに実在していなければならない。
            if (!await IsInColumnAsync(request.PrevTaskId, boardId.Value, request.PositionId)) return false;
            if (!await IsInColumnAsync(request.NextTaskId, boardId.Value, request.PositionId)) return false;

            if (Connection.State != ConnectionState.Open) Connection.Open();
            using var transaction = Connection.BeginTransaction();

            // 移動先カラムの行をロックしてから読む（同時に並べ替えても混ざらない）。
            var column = (await Connection.QueryAsync<TaskItem>($"""
                SELECT {Columns}
                FROM tasks
                WHERE board_id = @BoardId
                  AND position_id IS NOT DISTINCT FROM @PositionId
                  AND deleted_at IS NULL
                  AND id <> @Id
                ORDER BY order_index
                FOR UPDATE
                """,
                new { BoardId = boardId.Value, request.PositionId, Id = id },
                transaction)).ToList();

            var prev = column.FirstOrDefault(t => t.Id == request.PrevTaskId);
            var next = column.FirstOrDefault(t => t.Id == request.NextTaskId);

            var orderIndex = NextOrderIndex(prev?.OrderIndex, next?.OrderIndex);
            if (orderIndex is null)
            {
                // 中間値が作れない（精度が枯渇）。カラムを 0,1,2,… へ振り直し、
                // 移動するタスクを希望の位置へ差し込む。
                orderIndex = await RebalanceAsync(column, id, request.PrevTaskId, transaction);
            }

            await Connection.ExecuteAsync("""
                UPDATE tasks SET position_id = @PositionId, order_index = @OrderIndex WHERE id = @Id
                """,
                new { Id = id, request.PositionId, OrderIndex = orderIndex.Value },
                transaction);

            transaction.Commit();
            return true;
        }

        /// <summary>両隣の中間値。作れない（精度が枯渇した）場合は null。</summary>
        private static double? NextOrderIndex(double? prev, double? next)
        {
            if (prev is double p && next is double n)
            {
                var mid = (p + n) / 2;
                return mid > p && mid < n ? mid : null;
            }
            if (next is double onlyNext) return onlyNext - 1; // 先頭へ
            if (prev is double onlyPrev) return onlyPrev + 1; // 末尾へ
            return 0; // カラムが空
        }

        /// <summary>
        /// カラムを 0,1,2,… へ振り直し、移動するタスクが入るべき order_index を返す。
        /// 移動タスクは column に含まれない（呼び出し元で除外済み）ので、
        /// prev の直後に入るよう 0.5 刻みの隙間を空けて返す。
        /// </summary>
        private async Task<double> RebalanceAsync(
            List<TaskItem> column, Guid movingId, Guid? prevTaskId, IDbTransaction transaction)
        {
            for (var i = 0; i < column.Count; i++)
            {
                await Connection.ExecuteAsync(
                    "UPDATE tasks SET order_index = @OrderIndex WHERE id = @Id",
                    new { Id = column[i].Id, OrderIndex = (double)i },
                    transaction);
            }

            // prev が無ければ先頭（-1）。あれば prev の直後（prev の新しい番号 + 0.5）。
            var prevIndex = column.FindIndex(t => t.Id == prevTaskId);
            return prevTaskId is null ? -1 : prevIndex + 0.5;
        }

        /// <summary>指定タスクが、その board の指定カラムに（ゴミ箱でなく）実在するか。null は「指定なし」で true。</summary>
        private async Task<bool> IsInColumnAsync(Guid? taskId, Guid boardId, Guid? positionId)
        {
            if (taskId is not Guid value) return true;

            const string sql = """
            SELECT EXISTS (
              SELECT 1 FROM tasks
              WHERE id = @Id AND board_id = @BoardId
                AND position_id IS NOT DISTINCT FROM @PositionId
                AND deleted_at IS NULL
            )
            """;
            return await Connection.ExecuteScalarAsync<bool>(
                sql, new { Id = value, BoardId = boardId, PositionId = positionId });
        }

        /// <summary>削除（ソフト削除）。オーナーのみ。ゴミ箱へ移す。</summary>
        public async Task<bool> DeleteAsync(Guid id, Guid userId)
        {
            var sql = $"""
            UPDATE tasks SET deleted_at = now()
            WHERE id = @Id AND deleted_at IS NULL AND {OwnedByOwner}
            """;
            var affectedRows = await Connection.ExecuteAsync(sql, new { Id = id, UserId = userId });
            return affectedRows > 0;
        }

        /// <summary>ゴミ箱から戻す。オーナーのみ。</summary>
        public async Task<bool> RestoreAsync(Guid id, Guid userId)
        {
            var sql = $"""
            UPDATE tasks SET deleted_at = NULL
            WHERE id = @Id AND deleted_at IS NOT NULL AND {OwnedByOwner}
            """;
            var affectedRows = await Connection.ExecuteAsync(sql, new { Id = id, UserId = userId });
            return affectedRows > 0;
        }

        /// <summary>ゴミ箱から完全に削除する。オーナーのみ（ゴミ箱にある行だけ）。</summary>
        public async Task<bool> PurgeAsync(Guid id, Guid userId)
        {
            var sql = $"""
            DELETE FROM tasks
            WHERE id = @Id AND deleted_at IS NOT NULL AND {OwnedByOwner}
            """;
            var affectedRows = await Connection.ExecuteAsync(sql, new { Id = id, UserId = userId });
            return affectedRows > 0;
        }

        /// <summary>ゴミ箱を空にする（board 内の削除済みタスクを全て完全削除）。オーナーのみ。</summary>
        public async Task<bool> PurgeAllAsync(Guid boardId, Guid userId)
        {
            if (!await IsBoardOwnerAsync(boardId, userId)) return false;

            await Connection.ExecuteAsync(
                "DELETE FROM tasks WHERE board_id = @BoardId AND deleted_at IS NOT NULL",
                new { BoardId = boardId });
            return true;
        }

        /// <summary>task が認証ユーザーの参加する board に属していれば、その board_id を返す（ゴミ箱は除く）。</summary>
        private Task<Guid?> FindOwnedBoardIdAsync(Guid id, Guid userId)
        {
            const string sql = """
            SELECT t.board_id
            FROM tasks t
            JOIN board_members m ON m.board_id = t.board_id AND m.user_id = @UserId
            WHERE t.id = @Id AND t.deleted_at IS NULL
            """;
            return Connection.ExecuteScalarAsync<Guid?>(sql, new { Id = id, UserId = userId });
        }

        /// <summary>
        /// 割り当て先の妥当性を確認する。position・category は同一 board のものに、
        /// assignee は同一 board のメンバーに限る（他 board のポジション・カテゴリーや、
        /// メンバーでないユーザーを task に紐付けさせない）。
        /// board のメンバーであることは呼び出し前に確認済みなので、ここでは board 一致だけ見る。
        /// </summary>
        private async Task<bool> CanAssignAsync(Guid boardId, Guid? positionId, Guid? categoryId, Guid? assigneeId = null)
        {
            if (positionId is Guid position)
            {
                const string sql = "SELECT EXISTS (SELECT 1 FROM positions WHERE id = @Id AND board_id = @BoardId)";
                if (!await Connection.ExecuteScalarAsync<bool>(sql, new { Id = position, BoardId = boardId }))
                    return false;
            }

            if (categoryId is Guid category)
            {
                const string sql = "SELECT EXISTS (SELECT 1 FROM categories WHERE id = @Id AND board_id = @BoardId)";
                if (!await Connection.ExecuteScalarAsync<bool>(sql, new { Id = category, BoardId = boardId }))
                    return false;
            }

            if (assigneeId is Guid assignee)
            {
                const string sql = "SELECT EXISTS (SELECT 1 FROM board_members WHERE user_id = @Id AND board_id = @BoardId)";
                if (!await Connection.ExecuteScalarAsync<bool>(sql, new { Id = assignee, BoardId = boardId }))
                    return false;
            }

            return true;
        }
    }
}
