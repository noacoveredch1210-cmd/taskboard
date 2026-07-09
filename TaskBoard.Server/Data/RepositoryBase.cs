using System.Data;
using Dapper;

namespace TaskBoard.Server.Data
{
    /// <summary>
    /// リポジトリ共通の接続保持と、id 指定の削除処理を提供する基底クラス。
    /// </summary>
    public abstract class RepositoryBase
    {
        protected readonly IDbConnection Connection;

        protected RepositoryBase(IDbConnection connection)
        {
            Connection = connection;
        }

        protected async Task<bool> DeleteByIdAsync(string table, Guid id)
        {
            var sql = $"DELETE FROM {table} WHERE id = @Id";
            var affectedRows = await Connection.ExecuteAsync(sql, new { Id = id });
            return affectedRows > 0;
        }

        /// <summary>user_id 列を持つテーブルから、所有者本人の行だけを削除する。</summary>
        protected async Task<bool> DeleteOwnedAsync(string table, Guid id, Guid userId)
        {
            var sql = $"DELETE FROM {table} WHERE id = @Id AND user_id = @UserId";
            var affectedRows = await Connection.ExecuteAsync(sql, new { Id = id, UserId = userId });
            return affectedRows > 0;
        }

        /// <summary>board を当該ユーザーが所有しているか。positions / tasks の所有権判定の起点。</summary>
        protected Task<bool> OwnsBoardAsync(Guid boardId, Guid userId)
        {
            const string sql = "SELECT EXISTS (SELECT 1 FROM boards WHERE id = @BoardId AND user_id = @UserId)";
            return Connection.ExecuteScalarAsync<bool>(sql, new { BoardId = boardId, UserId = userId });
        }
    }
}
