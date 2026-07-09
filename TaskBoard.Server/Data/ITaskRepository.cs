using TaskBoard.Server.Models;

namespace TaskBoard.Server.Data
{
    /// <summary>
    /// task 自身は所有者を持たないため、board_id から boards.user_id を辿って所有権を判定する。
    /// 併せて、割り当て先の position（同一 board 内）と category（同一ユーザー）も検証する。
    /// </summary>
    public interface ITaskRepository
    {
        Task<IEnumerable<TaskItem>> GetByBoardIdAsync(Guid boardId, Guid userId);
        Task<TaskItem?> GetByIdAsync(Guid id, Guid userId);
        /// <summary>board を所有していない、または割り当て先が不正なら false を返し、行を作らない。</summary>
        Task<bool> CreateAsync(CreateTaskRequest request, Guid userId);
        Task<bool> UpdateAsync(Guid id, Guid userId, UpdateTaskRequest request);
        Task<bool> DeleteAsync(Guid id, Guid userId);
    }
}
