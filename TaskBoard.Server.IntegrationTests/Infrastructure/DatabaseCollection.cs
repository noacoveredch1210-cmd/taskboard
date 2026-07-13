namespace TaskBoard.Server.IntegrationTests.Infrastructure
{
    /// <summary>
    /// コンテナの起動は重いので、全テストクラスで 1 つの <see cref="PostgresFixture"/> を共有する。
    /// テスト間の独立性は各テスト冒頭の <c>ResetAsync</c> で担保する。
    /// </summary>
    [CollectionDefinition(Name)]
    public sealed class DatabaseCollection : ICollectionFixture<PostgresFixture>
    {
        public const string Name = "database";
    }
}
