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
    }
}
