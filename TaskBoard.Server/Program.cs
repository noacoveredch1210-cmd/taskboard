using System.Data;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddOpenApi();

builder.Services.AddCors(options =>
    options.AddPolicy("AllowFrontend", policy =>
        policy.WithOrigins(
                "https://your-app.vercel.app",   // 本番のVercel URL
                "http://localhost:5173"          // ローカル開発用
              )
              .AllowAnyMethod()
              .AllowAnyHeader()));

builder.Services.AddScoped<IDbConnection>(_ =>
    new NpgsqlConnection(Environment.GetEnvironmentVariable("DATABASE_URL")));

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("AllowFrontend");

app.UseAuthorization();

app.MapControllers();

app.Run();