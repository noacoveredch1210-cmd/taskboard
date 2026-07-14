using System.Data;
using Dapper;

namespace TaskBoard.Server.Data
{
    /// <summary>
    /// リポジトリ共通の接続保持と、メンバーシップ判定を提供する基底クラス。
    /// アクセス権は「その board のメンバーか」で判定する（board_members）。
    /// </summary>
    public abstract class RepositoryBase
    {
        protected readonly IDbConnection Connection;

        protected RepositoryBase(IDbConnection connection)
        {
            Connection = connection;
        }

        /// <summary>ユーザーが board のメンバーか。positions / tasks / categories のアクセス判定の起点。</summary>
        protected Task<bool> IsBoardMemberAsync(Guid boardId, Guid userId)
        {
            const string sql =
                "SELECT EXISTS (SELECT 1 FROM board_members WHERE board_id = @BoardId AND user_id = @UserId)";
            return Connection.ExecuteScalarAsync<bool>(sql, new { BoardId = boardId, UserId = userId });
        }

        /// <summary>ユーザーが board のオーナーか。ボード削除・メンバー管理の判定に使う。</summary>
        protected Task<bool> IsBoardOwnerAsync(Guid boardId, Guid userId)
        {
            const string sql =
                "SELECT EXISTS (SELECT 1 FROM board_members WHERE board_id = @BoardId AND user_id = @UserId AND role = 'owner')";
            return Connection.ExecuteScalarAsync<bool>(sql, new { BoardId = boardId, UserId = userId });
        }
    }
}
