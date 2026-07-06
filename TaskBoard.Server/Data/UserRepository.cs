using System.Data;
using Dapper;
using TaskBoard.Server.Models;

namespace TaskBoard.Server.Data
{
    public class UserRepository : RepositoryBase, IUserRepository
    {
        private const string Columns = "id, name, email, created_at AS CreatedAt";

        public UserRepository(IDbConnection connection) : base(connection) { }

        public async Task<User?> GetByIdAsync(Guid id)
        {
            var sql = $"""
            SELECT {Columns}
            FROM users
            WHERE id = @Id
            """;
            return await Connection.QuerySingleOrDefaultAsync<User>(sql, new { Id = id });
        }

        public async Task<User?> GetByEmailAsync(string email)
        {
            var sql = $"""
            SELECT {Columns}
            FROM users
            WHERE email = @Email
            """;
            return await Connection.QuerySingleOrDefaultAsync<User>(sql, new { Email = email });
        }

        public async Task CreateAsync(CreateUserRequest request)
        {
            const string sql = """
            INSERT INTO users (id, name, email)
            VALUES (@Id, @Name, @Email)
            """;
            await Connection.ExecuteAsync(sql, request);
        }

        public async Task EnsureAsync(Guid id, string name, string email)
        {
            const string sql = """
            INSERT INTO users (id, name, email)
            VALUES (@Id, @Name, @Email)
            ON CONFLICT (id) DO NOTHING
            """;
            await Connection.ExecuteAsync(sql, new { Id = id, Name = name, Email = email });
        }

        public async Task<bool> UpdateAsync(Guid id, UpdateUserRequest request)
        {
            const string sql = """
            UPDATE users
            SET name = @Name,
                email = @Email
            WHERE id = @Id
            """;
            var affectedRows = await Connection.ExecuteAsync(sql, new
            {
                Id = id,
                request.Name,
                request.Email
            });
            return affectedRows > 0;
        }

        public Task<bool> DeleteAsync(Guid id) => DeleteByIdAsync("users", id);
    }
}
