using System.Data;
using Dapper;
using TaskBoard.Server.Models;

namespace TaskBoard.Server.Data
{
    public class UserRepository : IUserRepository
    {
        private readonly IDbConnection _connection;

        public UserRepository(IDbConnection connection)
        {
            _connection = connection;
        }

        public async Task<User?> GetByIdAsync(Guid id)
        {
            const string sql = """
            SELECT id, name, email, created_at AS CreatedAt
            FROM users
            WHERE id = @Id
            """;
            return await _connection.QuerySingleOrDefaultAsync<User>(sql, new { Id = id });
        }

        public async Task<User?> GetByEmailAsync(string email)
        {
            const string sql = """
            SELECT id, name, email, created_at AS CreatedAt
            FROM users
            WHERE email = @Email
            """;
            return await _connection.QuerySingleOrDefaultAsync<User>(sql, new { Email = email });
        }

        public async Task CreateAsync(CreateUserRequest request)
        {
            const string sql = """
            INSERT INTO users (id, name, email)
            VALUES (@Id, @Name, @Email)
            """;
            await _connection.ExecuteAsync(sql, request);
        }

        public async Task<bool> UpdateAsync(Guid id, UpdateUserRequest request)
        {
            const string sql = """
            UPDATE users
            SET name = @Name,
                email = @Email
            WHERE id = @Id
            """;
            var affectedRows = await _connection.ExecuteAsync(sql, new
            {
                Id = id,
                request.Name,
                request.Email
            });
            return affectedRows > 0;
        }

        public async Task<bool> DeleteAsync(Guid id)
        {
            const string sql = "DELETE FROM users WHERE id = @Id";
            var affectedRows = await _connection.ExecuteAsync(sql, new { Id = id });
            return affectedRows > 0;
        }
    }
}