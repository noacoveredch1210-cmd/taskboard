using System.Data;
using Dapper;

namespace TaskBoard.Server.IntegrationTests.Infrastructure
{
    /// <summary>
    /// 各リポジトリテストの共通土台。テスト前に DB をリセットし、シード用のヘルパーを提供する。
    /// Docker が無い環境では <see cref="RequireDocker"/> がテストをスキップさせる。
    /// </summary>
    [Collection(DatabaseCollection.Name)]
    public abstract class IntegrationTestBase : IAsyncLifetime
    {
        protected readonly PostgresFixture Fixture;

        protected IntegrationTestBase(PostgresFixture fixture)
        {
            Fixture = fixture;
        }

        public async Task InitializeAsync()
        {
            // Docker が無ければリセットもできないので、その場合は何もしない（テスト側でスキップする）。
            await Fixture.ResetAsync();
        }

        public Task DisposeAsync() => Task.CompletedTask;

        /// <summary>Docker が使えないときはこのテストをスキップする。各テストの先頭で呼ぶ。</summary>
        protected void RequireDocker() => Skip.If(Fixture.SkipReason is not null, Fixture.SkipReason);

        /// <summary>
        /// 認証ユーザー（auth.users）とアプリユーザー（users）を作る。
        /// users.id には auth.users への外部キーがあるため、先に auth.users を用意する。
        /// </summary>
        protected static async Task SeedUserAsync(IDbConnection connection, Guid userId, string email)
        {
            await connection.ExecuteAsync(
                "INSERT INTO auth.users (id) VALUES (@Id)", new { Id = userId });
            await connection.ExecuteAsync(
                "INSERT INTO users (id, name, email) VALUES (@Id, @Name, @Email)",
                new { Id = userId, Name = "テストユーザー", Email = email });
        }
    }
}
