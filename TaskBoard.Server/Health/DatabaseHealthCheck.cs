using System.Data;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace TaskBoard.Server.Health
{
    /// <summary>
    /// データベースへ実際に接続できるかを確かめる readiness チェック。
    /// 接続文字列の欠落や認証エラーも「不健全」として扱い、例外を外へ投げない
    /// （ヘルスチェックの失敗でプロセスを落とさないため）。
    /// </summary>
    public class DatabaseHealthCheck : IHealthCheck
    {
        private readonly IServiceProvider _services;

        public DatabaseHealthCheck(IServiceProvider services)
        {
            _services = services;
        }

        public async Task<HealthCheckResult> CheckHealthAsync(
            HealthCheckContext context,
            CancellationToken cancellationToken = default)
        {
            try
            {
                // IDbConnection は Scoped。DATABASE_URL 未設定ならこの解決時に例外が出る。
                var connection = _services.GetRequiredService<IDbConnection>();

                if (connection is System.Data.Common.DbConnection dbConnection)
                {
                    await dbConnection.OpenAsync(cancellationToken);
                    await dbConnection.CloseAsync();
                }
                else
                {
                    connection.Open();
                    connection.Close();
                }

                return HealthCheckResult.Healthy("データベースへ接続できます。");
            }
            catch (Exception ex)
            {
                return HealthCheckResult.Unhealthy("データベースへ接続できません。", ex);
            }
        }
    }
}
