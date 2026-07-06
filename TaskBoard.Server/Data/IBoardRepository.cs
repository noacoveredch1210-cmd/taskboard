using TaskBoard.Server.Models;

namespace TaskBoard.Server.Data
{
    public interface IBoardRepository
    {
        Task<IEnumerable<Board>> GetByUserIdAsync(Guid userId);
        Task<Board?> GetByIdAsync(Guid id);
        Task CreateAsync(CreateBoardRequest request);
        Task<bool> UpdateAsync(Guid id, UpdateBoardRequest request);
        Task<bool> DeleteAsync(Guid id);
    }
}