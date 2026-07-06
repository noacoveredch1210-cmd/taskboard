using TaskBoard.Server.Models;

namespace TaskBoard.Server.Data
{
    public interface IUserRepository
    {
        Task<User?> GetByIdAsync(Guid id);
        Task<User?> GetByEmailAsync(string email);
        Task CreateAsync(CreateUserRequest request);
        Task<bool> UpdateAsync(Guid id, UpdateUserRequest request);
        Task<bool> DeleteAsync(Guid id);
    }
}