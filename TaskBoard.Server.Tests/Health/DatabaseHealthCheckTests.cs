using System.Data;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using NSubstitute;
using TaskBoard.Server.Health;

namespace TaskBoard.Server.Tests.Health
{
    public class DatabaseHealthCheckTests
    {
        private static readonly HealthCheckContext Context = new()
        {
            Registration = new HealthCheckRegistration(
                "database",
                _ => null!,
                HealthStatus.Unhealthy,
                tags: null),
        };

        /// <summary>IDbConnection の解決結果を差し替えた ServiceProvider を作る。</summary>
        private static IServiceProvider ProviderReturning(IDbConnection connection)
        {
            var services = new ServiceCollection();
            services.AddScoped(_ => connection);
            return services.BuildServiceProvider();
        }

        [Fact]
        public async Task 接続できれば_Healthy_を返す()
        {
            var connection = Substitute.For<IDbConnection>();
            var check = new DatabaseHealthCheck(ProviderReturning(connection));

            var result = await check.CheckHealthAsync(Context);

            Assert.Equal(HealthStatus.Healthy, result.Status);
            connection.Received(1).Open();
            connection.Received(1).Close();
        }

        [Fact]
        public async Task 接続に失敗しても例外を投げず_Unhealthy_を返す()
        {
            var connection = Substitute.For<IDbConnection>();
            var failure = new InvalidOperationException("接続できません");
            connection.When(c => c.Open()).Throw(failure);
            var check = new DatabaseHealthCheck(ProviderReturning(connection));

            var result = await check.CheckHealthAsync(Context);

            Assert.Equal(HealthStatus.Unhealthy, result.Status);
            Assert.Same(failure, result.Exception);
        }

        [Fact]
        public async Task 接続文字列が未設定なら_Unhealthy_を返す()
        {
            // DATABASE_URL 未設定のとき、IDbConnection の解決自体が失敗する経路。
            var services = new ServiceCollection();
            services.AddScoped<IDbConnection>(_ =>
                throw new InvalidOperationException("DATABASE_URL is not set."));
            var check = new DatabaseHealthCheck(services.BuildServiceProvider());

            var result = await check.CheckHealthAsync(Context);

            // プロセスを落とさず、不健全として報告する。
            Assert.Equal(HealthStatus.Unhealthy, result.Status);
        }
    }
}
