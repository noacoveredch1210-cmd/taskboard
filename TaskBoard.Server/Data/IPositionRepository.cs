using TaskBoard.Server.Models;

namespace TaskBoard.Server.Data
{
    /// <summary>
    /// position 自身は所有者を持たないため、board_id から boards.user_id を辿って所有権を判定する。
    /// </summary>
    public interface IPositionRepository
    {
        Task<IEnumerable<Position>> GetByBoardIdAsync(Guid boardId, Guid userId);
        Task<Position?> GetByIdAsync(Guid id, Guid userId);
        /// <summary>作成先の board を所有していなければ false を返し、行を作らない。</summary>
        Task<bool> CreateAsync(CreatePositionRequest request, Guid userId);
        Task<bool> UpdateAsync(Guid id, Guid userId, UpdatePositionRequest request);
        Task<bool> DeleteAsync(Guid id, Guid userId);
    }
}
