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
        /// <summary>削除（ソフト削除でゴミ箱へ）。オーナーのみ。</summary>
        Task<bool> DeleteAsync(Guid id, Guid userId);

        // ---- ゴミ箱（オーナーのみ） ----

        /// <summary>ゴミ箱（削除済み）のタスク一覧。オーナーでなければ空。</summary>
        Task<IEnumerable<TaskItem>> GetTrashByBoardIdAsync(Guid boardId, Guid userId);
        /// <summary>ゴミ箱から元に戻す。</summary>
        Task<bool> RestoreAsync(Guid id, Guid userId);
        /// <summary>ゴミ箱から完全に削除する。</summary>
        Task<bool> PurgeAsync(Guid id, Guid userId);
        /// <summary>ゴミ箱を空にする（そのボードの削除済みタスクを全て完全削除）。オーナーなら true。</summary>
        Task<bool> PurgeAllAsync(Guid boardId, Guid userId);
    }
}
