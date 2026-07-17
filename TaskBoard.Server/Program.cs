using Serilog;
using Serilog.Formatting.Compact;
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
using TaskBoard.Server.Services;

Dapper.SqlMapper.AddTypeHandler(new DateOnlyTypeHandler());
Dapper.SqlMapper.AddTypeHandler(new NullableDateOnlyTypeHandler());

var builder = WebApplication.CreateBuilder(args);

// 構造化ログ（Serilog）。既定のコンソールロガーと違い、ログを「文字列」ではなく
// 「名前付きの値を持つイベント」として出す。本番は 1 行 1 JSON で吐くので、
// ログ基盤側が status や elapsed で検索・集計できる。
// 相関 ID: Serilog は Activity.Current から TraceId を自動で拾い、JSON の "@tr" に出す。
// ASP.NET Core がリクエストごとに Activity を張るので、1 リクエスト中のログは
// 同じ TraceId で串刺しできる。
// この値は problem+json のエラー応答に載る traceId（W3C traceparent 形式の
// "00-{TraceId}-{SpanId}-{flags}"）の TraceId 部分と一致する。つまり利用者が
// 報告したエラーの traceId でログを検索すれば、その要求の記録に辿り着ける。
builder.Host.UseSerilog((context, configuration) =>
{
    configuration
        .ReadFrom.Configuration(context.Configuration)
        .Enrich.FromLogContext();

    if (context.HostingEnvironment.IsDevelopment())
    {
        // 開発中は人が読める 1 行形式（JSON だと目で追えない）。
        configuration.WriteTo.Console(
            outputTemplate:
            "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj} <{TraceId}>{NewLine}{Exception}");
    }
    else
    {
        configuration.WriteTo.Console(new CompactJsonFormatter());
    }
});

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

// Npgsql に ILoggerFactory を渡すと、SQL 1 本ごとに所要時間つきのログを出せる
// （"Command execution completed (duration={DurationMs}ms)"）。これが無いと
// 「この要求は 800ms」までは分かっても、その内訳が DB なのか自前の処理なのかを切り分けられない。
// 既定は静かにしておき（appsettings で Npgsql を Warning に落としている）、
// 遅い原因を追うときだけ Npgsql の水準を Debug へ上げる。値ではなく水準の切り替えで済む。
builder.Services.AddSingleton<NpgsqlDataSource>(serviceProvider =>
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

    var dataSourceBuilder = new NpgsqlDataSourceBuilder(connectionString);
    dataSourceBuilder.UseLoggerFactory(serviceProvider.GetRequiredService<ILoggerFactory>());
    // パラメータの値はログに出さない（既定）。利用者のデータが混ざらないようにする。
    return dataSourceBuilder.Build();
});

builder.Services.AddScoped<IDbConnection>(serviceProvider =>
    serviceProvider.GetRequiredService<NpgsqlDataSource>().CreateConnection());

builder.Services.AddScoped<ITaskRepository, TaskRepository>();
builder.Services.AddScoped<IBoardRepository, BoardRepository>();
builder.Services.AddScoped<IPositionRepository, PositionRepository>();
builder.Services.AddScoped<ICategoryRepository, CategoryRepository>();
builder.Services.AddScoped<IUserRepository, UserRepository>();

// 使い方ガイド用の AI アシスタント（Gemini）。API キーは GEMINI_API_KEY から実行時に読む。
builder.Services.AddHttpClient<IAiAssistant, GeminiAssistant>(client =>
{
    client.BaseAddress = new Uri("https://generativelanguage.googleapis.com/");
    client.Timeout = TimeSpan.FromSeconds(30);
});

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

    // AI は外部の有料/枠制限つきサービスを叩くため、ユーザー単位でさらに厳しく絞る
    // （グローバル制限と併用され、こちらが先に効く）。
    options.AddPolicy("ai", context =>
    {
        var partitionKey = context.User.FindFirstValue("sub")
            ?? context.Connection.RemoteIpAddress?.ToString()
            ?? "unknown";

        return RateLimitPartition.GetFixedWindowLimiter(partitionKey, _ =>
            new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
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

// リクエスト 1 本につき 1 行のまとめログを出す（メソッド・パス・ステータス・所要時間）。
// ASP.NET Core 既定の逐次ログより静かで、かつ構造化されている。
// ここに置く理由: 例外処理より内側なので、500 になった要求も「500 として」記録される。
app.UseSerilogRequestLogging(options =>
{
    options.EnrichDiagnosticContext = (diagnosticContext, httpContext) =>
    {
        // 誰の要求かを残す。ユーザー ID はトークンの sub のみを信頼する
        // （リクエスト本文の userId は見ない）方針に合わせる。
        var sub = httpContext.User.FindFirst("sub")?.Value;
        if (sub is not null) diagnosticContext.Set("UserId", sub);
    };
});

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