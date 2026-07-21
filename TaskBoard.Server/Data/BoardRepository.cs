using System.Data;
using Dapper;
using TaskBoard.Server.Models;

namespace TaskBoard.Server.Data
{
    public class BoardRepository : RepositoryBase, IBoardRepository
    {
        public BoardRepository(IDbConnection connection) : base(connection) { }

        /// <summary>
        /// 参加している全ボードを、中身（列・タスク・カテゴリー・メンバー）ごと返す。
        ///
        /// ボードごとにクエリを回すと N+1 になるので、種類ごとに 1 本ずつ引いてから
        /// メモリ上で振り分ける。ボードが何枚でもクエリは 5 本で一定。
        ///
        /// 各クエリは「自分が参加しているボードのものか」を EXISTS で自分自身に課している。
        /// 先に取った board の id で絞れば同じ結果になるが、それは「アプリ側で絞った」だけで、
        /// クエリ単体では無防備になる。この方針（所有権を SQL に埋める）は崩さない。
        /// </summary>
        public async Task<IEnumerable<BoardDetail>> GetDetailsForUserAsync(Guid userId)
        {
            var boards = (await GetForUserAsync(userId)).ToList();
            if (boards.Count == 0) return [];

            const string memberOfBoard =
                "EXISTS (SELECT 1 FROM board_members m WHERE m.board_id = {0}.board_id AND m.user_id = @UserId)";
            var parameters = new { UserId = userId };

            var positions = await Connection.QueryAsync<Position>($"""
                SELECT id, board_id AS BoardId, name, order_index AS OrderIndex, created_at AS CreatedAt
                FROM positions p
                WHERE {string.Format(memberOfBoard, "p")}
                ORDER BY order_index
                """, parameters);

            // ゴミ箱（deleted_at 非 NULL）は通常の一覧に混ぜない。
            var tasks = await Connection.QueryAsync<TaskItem>($"""
                SELECT id, board_id AS BoardId, position_id AS PositionId, category_id AS CategoryId,
                       assignee_id AS AssigneeId, name, comment, importance, deadline,
                       order_index AS OrderIndex, created_at AS CreatedAt
                FROM tasks t
                WHERE t.deleted_at IS NULL AND {string.Format(memberOfBoard, "t")}
                ORDER BY order_index
                """, parameters);

            var categories = await Connection.QueryAsync<Category>($"""
                SELECT id, board_id AS BoardId, name, color, created_at AS CreatedAt
                FROM categories c
                WHERE {string.Format(memberOfBoard, "c")}
                ORDER BY created_at
                """, parameters);

            // メンバー一覧だけは述語の書き方が違う。board_members 自身に
            // 「その board のメンバーか」を課すと、行そのものがメンバー行なので常に真になり、
            // 全ユーザーのメンバー行を取ってしまう。「自分も同じ board に居るか」を別名で問う。
            var members = await Connection.QueryAsync<BoardMemberRow>("""
                SELECT m.board_id AS BoardId, u.id AS UserId, u.name, u.email, m.role
                FROM board_members m
                JOIN users u ON u.id = m.user_id
                WHERE EXISTS (SELECT 1 FROM board_members me
                              WHERE me.board_id = m.board_id AND me.user_id = @UserId)
                ORDER BY m.created_at
                """, parameters);

            // 振り分けは Dictionary で行う。ToLookup だと、述語をすり抜けた行があっても
            // どのボードにも属さないまま黙って捨てられ、SQL 側の絞り込みが壊れていても
            // 誰も気づけない。ここでは「取ってきた行はすべて、どれかのボードに属する」ことを
            // 明示的に確かめ、そうでなければ落とす。
            var details = boards.ToDictionary(board => board.Id, board => new BoardDetail
            {
                Id = board.Id,
                ShortName = board.ShortName,
                Title = board.Title,
                Role = board.Role,
                CreatedAt = board.CreatedAt,
            });

            /// <summary>行を所属ボードへ配る。属先が無い＝クエリの所有権条件が壊れている。</summary>
            void Distribute<T>(IEnumerable<T> rows, Func<T, Guid> boardIdOf, Action<BoardDetail, T> add)
            {
                foreach (var row in rows)
                {
                    if (!details.TryGetValue(boardIdOf(row), out var detail))
                    {
                        throw new InvalidOperationException(
                            $"参加していない board の {typeof(T).Name} を取得しました。");
                    }
                    add(detail, row);
                }
            }

            Distribute(positions, p => p.BoardId, (d, row) => d.Positions.Add(row));
            Distribute(tasks, t => t.BoardId, (d, row) => d.Tasks.Add(row));
            Distribute(categories, c => c.BoardId, (d, row) => d.Categories.Add(row));
            Distribute(members, m => m.BoardId, (d, row) => d.Members.Add(row));

            return boards.Select(board => details[board.Id]);
        }

        public async Task<IEnumerable<Board>> GetForUserAsync(Guid userId)
        {
            // 参加しているボードだけを、自分の役割付きで返す。
            const string sql = """
            SELECT b.id, b.user_id AS UserId, b.short_name AS ShortName, b.title, m.role AS Role, b.created_at AS CreatedAt
            FROM boards b
            JOIN board_members m ON m.board_id = b.id
            WHERE m.user_id = @UserId
            ORDER BY b.created_at
            """;
            return await Connection.QueryAsync<Board>(sql, new { UserId = userId });
        }

        public async Task<Board?> GetByIdAsync(Guid id, Guid userId)
        {
            const string sql = """
            SELECT b.id, b.user_id AS UserId, b.short_name AS ShortName, b.title, m.role AS Role, b.created_at AS CreatedAt
            FROM boards b
            JOIN board_members m ON m.board_id = b.id AND m.user_id = @UserId
            WHERE b.id = @Id
            """;
            return await Connection.QuerySingleOrDefaultAsync<Board>(sql, new { Id = id, UserId = userId });
        }

        /// <summary>
        /// ボードを作る。本体・作成者のオーナー登録・最初の列を 1 トランザクションで行う。
        ///
        /// 分けて書くと途中で失敗したときに中途半端なものが残る。オーナー登録が抜ければ
        /// 誰も入れないボード、列の作成が抜ければ列が足りないボードができ、
        /// どちらも利用者からは直しようがない。
        /// </summary>
        public async Task CreateAsync(CreateBoardRequest request)
        {
            if (Connection.State != ConnectionState.Open) Connection.Open();
            using var transaction = Connection.BeginTransaction();

            const string insertBoard = """
            INSERT INTO boards (id, user_id, short_name, title)
            VALUES (@Id, @UserId, @ShortName, @Title)
            """;
            await Connection.ExecuteAsync(insertBoard, request, transaction);

            const string insertOwner = """
            INSERT INTO board_members (board_id, user_id, role)
            VALUES (@BoardId, @UserId, 'owner')
            """;
            await Connection.ExecuteAsync(
                insertOwner, new { BoardId = request.Id, request.UserId }, transaction);

            // 最初の列。配列の位置がそのまま order_index になる。
            const string insertPosition = """
            INSERT INTO positions (id, board_id, name, order_index)
            VALUES (@Id, @BoardId, @Name, @OrderIndex)
            """;
            var positions = request.Positions ?? [];
            for (var i = 0; i < positions.Count; i++)
            {
                await Connection.ExecuteAsync(insertPosition, new
                {
                    positions[i].Id,
                    BoardId = request.Id,
                    positions[i].Name,
                    OrderIndex = (double)i
                }, transaction);
            }

            transaction.Commit();
        }

        /// <summary>
        /// ボードの編集（タイトル・略称・列）。オーナーのみ。
        ///
        /// 列は「あるべき姿」を丸ごと受け取り、追加・改名・並べ替え・削除をまとめて適用する。
        /// 1 トランザクションにするのは、これが複数の書き込みに分かれるため。個別のリクエストで
        /// 投げると、途中で失敗したときに「列は消えたのにタスクの退避は済んでいない」といった
        /// 中途半端な状態がサーバーに残る。
        /// </summary>
        public async Task<bool> UpdateAsync(Guid id, Guid userId, UpdateBoardRequest request)
        {
            if (Connection.State != ConnectionState.Open) Connection.Open();
            using var transaction = Connection.BeginTransaction();

            const string sql = """
            UPDATE boards
            SET short_name = @ShortName,
                title = @Title
            WHERE id = @Id
              AND EXISTS (SELECT 1 FROM board_members m WHERE m.board_id = boards.id AND m.user_id = @UserId AND m.role = 'owner')
            """;
            var affectedRows = await Connection.ExecuteAsync(sql, new
            {
                Id = id,
                UserId = userId,
                request.ShortName,
                request.Title
            }, transaction);

            // 0 件＝存在しないか、オーナーでない。列にも触れずに終わる。
            if (affectedRows == 0) return false;

            if (request.Positions is not null)
            {
                await ApplyPositionsAsync(id, request.Positions, transaction);
            }

            transaction.Commit();
            return true;
        }

        /// <summary>送られてきた列の並びを、そのボードの列に反映する（追加・改名・並べ替え・削除）。</summary>
        private async Task ApplyPositionsAsync(
            Guid boardId, List<BoardPositionRequest> positions, IDbTransaction transaction)
        {
            // 追加と更新。配列の位置がそのまま order_index になる。
            // ON CONFLICT の WHERE は、他ボードの列 id を送りつけられても書き換えさせないための鍵。
            // （id は全ボード共通の PK なので、これが無いと他人の列を改名・並べ替えできてしまう）
            const string upsertSql = """
            INSERT INTO positions (id, board_id, name, order_index)
            VALUES (@Id, @BoardId, @Name, @OrderIndex)
            ON CONFLICT (id) DO UPDATE
              SET name = EXCLUDED.name, order_index = EXCLUDED.order_index
              WHERE positions.board_id = @BoardId
            """;
            for (var i = 0; i < positions.Count; i++)
            {
                await Connection.ExecuteAsync(upsertSql, new
                {
                    positions[i].Id,
                    BoardId = boardId,
                    positions[i].Name,
                    OrderIndex = (double)i
                }, transaction);
            }

            var keepIds = positions.Select(p => p.Id).ToArray();

            // 消える列にあったタスクは、先頭の列へ退避してから列を消す。
            // 先に列を消すと FK の ON DELETE SET NULL で未配置になり、画面から見えなくなる。
            // この「退避してから削除」の順序は、同じトランザクションの中だから保証できる。
            var fallbackId = positions.Count > 0 ? positions[0].Id : (Guid?)null;
            await Connection.ExecuteAsync("""
            UPDATE tasks SET position_id = @FallbackId
            WHERE board_id = @BoardId
              AND position_id IS NOT NULL
              AND NOT (position_id = ANY(@KeepIds))
            """, new { BoardId = boardId, FallbackId = fallbackId, KeepIds = keepIds }, transaction);

            await Connection.ExecuteAsync("""
            DELETE FROM positions
            WHERE board_id = @BoardId AND NOT (id = ANY(@KeepIds))
            """, new { BoardId = boardId, KeepIds = keepIds }, transaction);
        }

        public async Task<bool> DeleteAsync(Guid id, Guid userId)
        {
            // 削除はオーナーだけ。
            const string sql = """
            DELETE FROM boards
            WHERE id = @Id
              AND EXISTS (SELECT 1 FROM board_members m
                          WHERE m.board_id = boards.id AND m.user_id = @UserId AND m.role = 'owner')
            """;
            var affectedRows = await Connection.ExecuteAsync(sql, new { Id = id, UserId = userId });
            return affectedRows > 0;
        }

        public async Task<Guid?> GetShareTokenAsync(Guid boardId, Guid userId)
        {
            if (!await IsBoardOwnerAsync(boardId, userId)) return null;

            const string sql = "SELECT share_token FROM boards WHERE id = @Id";
            return await Connection.ExecuteScalarAsync<Guid?>(sql, new { Id = boardId });
        }

        public async Task<JoinOutcome> RequestJoinByTokenAsync(Guid token, Guid userId)
        {
            var boardId = await Connection.ExecuteScalarAsync<Guid?>(
                "SELECT id FROM boards WHERE share_token = @Token", new { Token = token });
            if (boardId is null) return new JoinOutcome(JoinResult.NotFound, null);

            if (await IsBoardMemberAsync(boardId.Value, userId))
                return new JoinOutcome(JoinResult.AlreadyMember, boardId);

            // 即メンバーにはせず、保留リクエストとして積む（オーナーの承認待ち）。
            await Connection.ExecuteAsync("""
                INSERT INTO board_join_requests (board_id, user_id)
                VALUES (@BoardId, @UserId)
                ON CONFLICT (board_id, user_id) DO NOTHING
                """, new { BoardId = boardId, UserId = userId });

            return new JoinOutcome(JoinResult.Requested, boardId);
        }

        public async Task<IEnumerable<BoardMember>> GetJoinRequestsAsync(Guid boardId, Guid userId)
        {
            if (!await IsBoardOwnerAsync(boardId, userId)) return [];

            const string sql = """
            SELECT u.id AS UserId, u.name, u.email, '' AS Role
            FROM board_join_requests r
            JOIN users u ON u.id = r.user_id
            WHERE r.board_id = @BoardId
            ORDER BY r.created_at
            """;
            return await Connection.QueryAsync<BoardMember>(sql, new { BoardId = boardId });
        }

        public async Task<bool> ApproveJoinRequestAsync(Guid boardId, Guid actingUserId, Guid targetUserId)
        {
            if (!await IsBoardOwnerAsync(boardId, actingUserId)) return false;

            // リクエストが無ければ承認しない。
            var deleted = await Connection.ExecuteAsync(
                "DELETE FROM board_join_requests WHERE board_id = @BoardId AND user_id = @TargetUserId",
                new { BoardId = boardId, TargetUserId = targetUserId });
            if (deleted == 0) return false;

            await Connection.ExecuteAsync("""
                INSERT INTO board_members (board_id, user_id, role)
                VALUES (@BoardId, @TargetUserId, 'member')
                ON CONFLICT (board_id, user_id) DO NOTHING
                """, new { BoardId = boardId, TargetUserId = targetUserId });
            return true;
        }

        public async Task<bool> RejectJoinRequestAsync(Guid boardId, Guid actingUserId, Guid targetUserId)
        {
            if (!await IsBoardOwnerAsync(boardId, actingUserId)) return false;

            var affectedRows = await Connection.ExecuteAsync(
                "DELETE FROM board_join_requests WHERE board_id = @BoardId AND user_id = @TargetUserId",
                new { BoardId = boardId, TargetUserId = targetUserId });
            return affectedRows > 0;
        }

        public async Task<IEnumerable<BoardMember>> GetMembersAsync(Guid boardId, Guid userId)
        {
            if (!await IsBoardMemberAsync(boardId, userId)) return [];

            const string sql = """
            SELECT u.id AS UserId, u.name, u.email, m.role
            FROM board_members m
            JOIN users u ON u.id = m.user_id
            WHERE m.board_id = @BoardId
            ORDER BY m.created_at
            """;
            return await Connection.QueryAsync<BoardMember>(sql, new { BoardId = boardId });
        }

        public async Task<bool> RemoveMemberAsync(Guid boardId, Guid actingUserId, Guid targetUserId)
        {
            // 本人の退出は常に可。他人を外すのはオーナーのみ。
            var self = actingUserId == targetUserId;
            if (!self && !await IsBoardOwnerAsync(boardId, actingUserId)) return false;

            // 対象がオーナーのときの扱い:
            //   - 他人のオーナーは外せない（自分で退出するのは可）
            //   - 最後の 1 人のオーナーは退出できない（管理者不在を防ぐ。降格の保護と同じ考え方）
            if (await IsBoardOwnerAsync(boardId, targetUserId))
            {
                if (!self) return false;

                var ownerCount = await Connection.ExecuteScalarAsync<int>(
                    "SELECT COUNT(*) FROM board_members WHERE board_id = @BoardId AND role = 'owner'",
                    new { BoardId = boardId });
                if (ownerCount <= 1) return false;
            }

            var affectedRows = await Connection.ExecuteAsync(
                "DELETE FROM board_members WHERE board_id = @BoardId AND user_id = @TargetUserId",
                new { BoardId = boardId, TargetUserId = targetUserId });
            if (affectedRows == 0) return false;

            // 抜けた人が担当していたタスクは未担当に戻す
            // （assignee は「同一 board のメンバー」に限る不変条件を保つ）。
            await Connection.ExecuteAsync(
                "UPDATE tasks SET assignee_id = NULL WHERE board_id = @BoardId AND assignee_id = @TargetUserId",
                new { BoardId = boardId, TargetUserId = targetUserId });

            return true;
        }

        public async Task<bool> SetMemberRoleAsync(
            Guid boardId, Guid actingUserId, Guid targetUserId, string role)
        {
            // 役割変更はオーナーのみ。
            if (!await IsBoardOwnerAsync(boardId, actingUserId)) return false;

            // 最後の 1 人のオーナーを降格させない（ボードが管理不能になるのを防ぐ）。
            if (role == "member")
            {
                const string countSql =
                    "SELECT COUNT(*) FROM board_members WHERE board_id = @BoardId AND role = 'owner'";
                var ownerCount = await Connection.ExecuteScalarAsync<int>(countSql, new { BoardId = boardId });

                const string targetSql =
                    "SELECT EXISTS (SELECT 1 FROM board_members WHERE board_id = @BoardId AND user_id = @TargetUserId AND role = 'owner')";
                var targetIsOwner = await Connection.ExecuteScalarAsync<bool>(
                    targetSql, new { BoardId = boardId, TargetUserId = targetUserId });

                if (targetIsOwner && ownerCount <= 1) return false;
            }

            const string sql = """
            UPDATE board_members SET role = @Role
            WHERE board_id = @BoardId AND user_id = @TargetUserId
            """;
            var affectedRows = await Connection.ExecuteAsync(sql,
                new { BoardId = boardId, TargetUserId = targetUserId, Role = role });
            return affectedRows > 0;
        }
    }
}
