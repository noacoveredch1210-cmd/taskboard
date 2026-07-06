using Npgsql;
using System.Data;
using TaskBoard.Server.Data;

Dapper.SqlMapper.AddTypeHandler(new DateOnlyTypeHandler());
Dapper.SqlMapper.AddTypeHandler(new NullableDateOnlyTypeHandler());

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddCors(options =>
    options.AddPolicy("AllowFrontend", policy =>
        policy.WithOrigins(
                "https://your-app.vercel.app",   // 本番のVercel URL
                "http://localhost:5173"          // ローカル開発用
              )
              .AllowAnyMethod()
              .AllowAnyHeader()));

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

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowFrontend");

app.UseAuthorization();

app.MapControllers();

app.Run();