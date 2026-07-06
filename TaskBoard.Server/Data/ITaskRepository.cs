using TaskBoard.Server.Models;

namespace TaskBoard.Server.Data
{
    public interface ITaskRepository
    {
        Task<IEnumerable<TaskItem>> GetByBoardIdAsync(Guid boardId);
        Task<TaskItem?> GetByIdAsync(Guid id);
        Task CreateAsync(CreateTaskRequest request);
        Task<bool> UpdateAsync(Guid id, UpdateTaskRequest request);
        Task<bool> DeleteAsync(Guid id);
    }
}