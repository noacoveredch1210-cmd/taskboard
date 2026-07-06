using TaskBoard.Server.Models;

namespace TaskBoard.Server.Data
{
    public interface ICategoryRepository
    {
        Task<IEnumerable<Category>> GetByUserIdAsync(Guid userId);
        Task<Category?> GetByIdAsync(Guid id);
        Task CreateAsync(CreateCategoryRequest request);
        Task<bool> UpdateAsync(Guid id, UpdateCategoryRequest request);
        Task<bool> DeleteAsync(Guid id);
    }
}