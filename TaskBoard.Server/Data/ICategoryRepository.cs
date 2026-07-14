using TaskBoard.Server.Models;

namespace TaskBoard.Server.Data
{
    /// <summary>
    /// category はボードに属する。アクセス権は board_members で判定する
    /// （そのボードのメンバーでなければ null / false を返す）。
    /// </summary>
    public interface ICategoryRepository
    {
        Task<IEnumerable<Category>> GetByBoardIdAsync(Guid boardId, Guid userId);
        Task<Category?> GetByIdAsync(Guid id, Guid userId);
        /// <summary>作成先の board のメンバーでなければ false を返し、行を作らない。</summary>
        Task<bool> CreateAsync(CreateCategoryRequest request, Guid userId);
        Task<bool> UpdateAsync(Guid id, Guid userId, UpdateCategoryRequest request);
        Task<bool> DeleteAsync(Guid id, Guid userId);
    }
}
