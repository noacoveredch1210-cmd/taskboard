using System.Data;
using Dapper;
using Npgsql;
using TaskBoard.Server.Data;
using Testcontainers.PostgreSql;

namespace TaskBoard.Server.IntegrationTests.Infrastructure
{
    /// <summary>
    /// テスト用の PostgreSQL を Docker コンテナとして起動し、本番と同じ db/schema.sql を流し込む。
    ///
    /// Docker が使えない環境（この開発 PC など）では起動に失敗するが、その場合は例外を握って
    /// <see cref="SkipReason"/> を設定するだけにとどめ、各テストは Skippable で自動スキップする。
    /// CI（GitHub Actions）には Docker が同梱されているため、そちらでは実行される。
    /// </summary>
    public sealed class PostgresFixture : IAsyncLifetime
    {
        private PostgreSqlContainer? _container;

        /// <summary>null なら Docker が利用可能で、コンテナが起動している。</summary>
        public string? SkipReason { get; private set; }

        public async Task InitializeAsync()
        {
            // tasks.deadline は DateOnly。本番は Program.cs で登録しているため、ここでも同じ登録を行う。
            SqlMapper.AddTypeHandler(new DateOnlyTypeHandler());
            SqlMapper.AddTypeHandler(new NullableDateOnlyTypeHandler());

            try
            {
                _container = new PostgreSqlBuilder()
                    .WithImage("postgres:16-alpine")
                    .Build();

                await _container.StartAsync();
                await ApplySchemaAsync();
            }
            catch (Exception ex)
            {
                // Docker が無い / 起動できない。テストはスキップ扱いにする。
                SkipReason = $"Docker が利用できないため統合テストをスキップします: {ex.Message}";
                _container = null;
            }
        }

        public async Task DisposeAsync()
        {
            if (_container is not null)
            {
                await _container.DisposeAsync();
            }
        }

        /// <summary>開いた接続を返す。テストごとに新しい接続を使う。</summary>
        public async Task<IDbConnection> OpenConnectionAsync()
        {
            if (_container is null)
            {
                throw new InvalidOperationException(
                    "コンテナが起動していません。テスト側で Skip.If による判定を先に行ってください。");
            }

            var connection = new NpgsqlConnection(_container.GetConnectionString());
            await connection.OpenAsync();
            return connection;
        }

        /// <summary>全テーブルを空にする。各テストの冒頭で呼び、テスト間の独立性を保つ。</summary>
        public async Task ResetAsync()
        {
            if (_container is null) return;

            await using var connection = new NpgsqlConnection(_container.GetConnectionString());
            await connection.OpenAsync();

            // auth.users を起点に CASCADE で users → boards → positions/tasks まで一掃する。
            await connection.ExecuteAsync(
                """TRUNCATE auth.users, categories RESTART IDENTITY CASCADE;""");
        }

        private async Task ApplySchemaAsync()
        {
            var schemaPath = Path.Combine(AppContext.BaseDirectory, "schema.sql");
            var schema = await File.ReadAllTextAsync(schemaPath);

            await using var connection = new NpgsqlConnection(_container!.GetConnectionString());
            await connection.OpenAsync();
            await connection.ExecuteAsync(schema);
        }
    }
}
