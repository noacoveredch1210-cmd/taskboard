using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
using System.Data;
using System.Security.Claims;
using System.Threading.RateLimiting;
using TaskBoard.Server.Data;
using TaskBoard.Server.Health;

Dapper.SqlMapper.AddTypeHandler(new DateOnlyTypeHandler());
Dapper.SqlMapper.AddTypeHandler(new NullableDateOnlyTypeHandler());

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// エラー応答を RFC 9457 の problem+json に統一する。
// 未処理例外は 500、認証エラーやバリデーション失敗も同じ形で返る。
builder.Services.AddProblemDetails();

builder.Services.AddCors(options =>
    options.AddPolicy("AllowFrontend", policy =>
        policy.WithOrigins(
                "https://taskboard-zeta-eight.vercel.app",   // 本番のVercel URL
                "http://localhost:5173"          // ローカル開発用
              )
              .AllowAnyMethod()
              .AllowAnyHeader()));

// Supabase Auth が発行した JWT を検証する（トークンの署名/発行者/有効期限をサーバーで確認）。
// SUPABASE_URL 例: https://xxxxxxxx.supabase.co
// 署名は Supabase の非対称キー(ES256)。公開鍵は OIDC ディスカバリ
// （{SUPABASE_URL}/auth/v1/.well-known/openid-configuration → jwks_uri）から自動取得する。
var supabaseUrl = Environment.GetEnvironmentVariable("SUPABASE_URL")
    ?? throw new InvalidOperationException("SUPABASE_URL is not set.");
var authority = $"{supabaseUrl}/auth/v1";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // OIDC メタデータから発行者情報と署名用公開鍵(JWKS)を取得する。
        options.Authority = authority;
        // "sub" などのクレーム名を .NET 独自名にマッピングせず、そのまま扱う。
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = authority,
            ValidateAudience = true,
            ValidAudience = "authenticated",
            ValidateIssuerSigningKey = true,
            ValidateLifetime = true,
            NameClaimType = "sub",
        };
    });

builder.Services.AddScoped<IDbConnection>(_ =>
{
    var databaseUrl = Environment.GetEnvironmentVariable("DATABASE_URL")
        ?? throw new InvalidOperationException("DATABASE_URL is not set.");

    var uri = new Uri(databaseUrl);
    var userInfo = uri.UserInfo.Split(':');

    var connectionString = new NpgsqlConnectionStringBuilder
    {
        Host = uri.Host,
        Port = uri.Port,
        Username = userInfo[0],
        Password = Uri.UnescapeDataString(userInfo[1]),
        Database = uri.AbsolutePath.TrimStart('/'),
        SslMode = SslMode.Require
    }.ToString();

    return new NpgsqlConnection(connectionString);
});

builder.Services.AddScoped<ITaskRepository, TaskRepository>();
builder.Services.AddScoped<IBoardRepository, BoardRepository>();
builder.Services.AddScoped<IPositionRepository, PositionRepository>();
builder.Services.AddScoped<ICategoryRepository, CategoryRepository>();
builder.Services.AddScoped<IUserRepository, UserRepository>();

// liveness（プロセスが生きているか）と readiness（依存先に繋がるか）を分ける。
// コンテナの再起動判定に readiness を使うと、DB の一時的な不調でアプリが落ち続ける。
builder.Services.AddHealthChecks()
    .AddCheck<DatabaseHealthCheck>("database", tags: ["ready"]);

// 1 ユーザーあたりの呼び出し回数を制限する（未認証の呼び出しは接続元 IP で束ねる）。
const int RateLimitWindowSeconds = 60;

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    // 拒否したときは、いつ再試行してよいかを伝える。
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.Headers.RetryAfter =
            RateLimitWindowSeconds.ToString();

        var problemDetailsService = context.HttpContext.RequestServices
            .GetService<IProblemDetailsService>();

        if (problemDetailsService is not null)
        {
            context.HttpContext.Response.StatusCode =
                StatusCodes.Status429TooManyRequests;

            await problemDetailsService.WriteAsync(new ProblemDetailsContext
            {
                HttpContext = context.HttpContext,
                ProblemDetails =
                {
                    Status = StatusCodes.Status429TooManyRequests,
                    Title = "Too Many Requests",
                    Detail = $"リクエストが多すぎます。{RateLimitWindowSeconds} 秒後に再試行してください。",
                },
            });
        }
    };

    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
    {
        var partitionKey = context.User.FindFirstValue("sub")
            ?? context.Connection.RemoteIpAddress?.ToString()
            ?? "unknown";

        return RateLimitPartition.GetFixedWindowLimiter(partitionKey, _ =>
            new FixedWindowRateLimiterOptions
            {
                PermitLimit = 100,
                Window = TimeSpan.FromSeconds(RateLimitWindowSeconds),
                QueueLimit = 0,
            });
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
// 未処理例外を problem+json に変換する。開発環境では詳細画面を優先する。
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    app.UseSwagger();
    app.UseSwaggerUI();
}
else
{
    app.UseExceptionHandler();
}

// 本文の無いエラー応答（401 など）にも problem+json の本文を付ける。
app.UseStatusCodePages();

app.UseCors("AllowFrontend");

app.UseAuthentication();

// 認証と認可の間に置く。
//   - 認証の後  → User が埋まっているので、ログイン済みの呼び出しをユーザー単位で数えられる
//   - 認可の前  → 401 で打ち切られる未認証の連打も数えられる（ここが一番制限したい）
app.UseRateLimiter();

app.UseAuthorization();

// liveness: 依存先は見ず、プロセスが応答することだけを確かめる。
app.MapHealthChecks("/health", new HealthCheckOptions
{
    Predicate = _ => false,
}).DisableRateLimiting();

// readiness: DB へ接続できるかまで確かめる。
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready"),
}).DisableRateLimiting();

app.MapControllers();

app.Run();