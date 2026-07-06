using TaskBoard.Server.Models;

namespace TaskBoard.Server.Data
{
    public interface IPositionRepository
    {
        Task<IEnumerable<Position>> GetByBoardIdAsync(Guid boardId);
        Task<Position?> GetByIdAsync(Guid id);
        Task CreateAsync(CreatePositionRequest request);
        Task<bool> UpdateAsync(Guid id, UpdatePositionRequest request);
        Task<bool> DeleteAsync(Guid id);
    }
}