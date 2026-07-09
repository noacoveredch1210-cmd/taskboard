using TaskBoard.Server.Models;

namespace TaskBoard.Server.Data
{
    /// <summary>
    /// category は user_id に所有者を持つ。id を指定する操作はすべて所有者 ID を併せて受け取る。
    /// </summary>
    public interface ICategoryRepository
    {
        Task<IEnumerable<Category>> GetByUserIdAsync(Guid userId);
        Task<Category?> GetByIdAsync(Guid id, Guid userId);
        Task CreateAsync(CreateCategoryRequest request);
        Task<bool> UpdateAsync(Guid id, Guid userId, UpdateCategoryRequest request);
        Task<bool> DeleteAsync(Guid id, Guid userId);
    }
}
