using TaskBoard.Server.Models;

namespace TaskBoard.Server.Data
{
    /// <summary>
    /// board は user_id に所有者を持つ。id を指定する操作はすべて所有者 ID を併せて受け取り、
    /// 他人の board には触れられないようにする（該当しなければ null / false を返す）。
    /// </summary>
    public interface IBoardRepository
    {
        Task<IEnumerable<Board>> GetByUserIdAsync(Guid userId);
        Task<Board?> GetByIdAsync(Guid id, Guid userId);
        Task CreateAsync(CreateBoardRequest request);
        Task<bool> UpdateAsync(Guid id, Guid userId, UpdateBoardRequest request);
        Task<bool> DeleteAsync(Guid id, Guid userId);
    }
}
