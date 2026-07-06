using TaskBoard.Server.Models;

namespace TaskBoard.Server.Data
{
    public interface IUserRepository
    {
        Task<User?> GetByIdAsync(Guid id);
        Task<User?> GetByEmailAsync(string email);
        Task CreateAsync(CreateUserRequest request);
        /// <summary>ユーザーが未登録なら作成する（初回ログイン用の upsert）。</summary>
        Task EnsureAsync(Guid id, string name, string email);
        Task<bool> UpdateAsync(Guid id, UpdateUserRequest request);
        Task<bool> DeleteAsync(Guid id);
    }
}