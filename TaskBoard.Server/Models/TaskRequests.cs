using System.ComponentModel.DataAnnotations;

namespace TaskBoard.Server.Models
{
    /// <summary>
    /// タスクの新規作成。order_index は受け取らない。新規タスクは常にそのカラムの先頭へ
    /// 入れる決まりなので、サーバーが「現在の最小値 - 1」を採番する。
    /// </summary>
    public class CreateTaskRequest
    {
        public Guid Id { get; set; }
        public Guid BoardId { get; set; }
        public Guid? PositionId { get; set; }
        public Guid? CategoryId { get; set; }
        public Guid? AssigneeId { get; set; }
        [MaxLength(TextLimits.TaskName)]
        public string Name { get; set; } = string.Empty;
        [MaxLength(TextLimits.TaskComment)]
        public string? Comment { get; set; }
        [Range(TextLimits.ImportanceMin, TextLimits.ImportanceMax)]
        public int? Importance { get; set; }
        public DateOnly? Deadline { get; set; }
    }

    /// <summary>
    /// タスクの編集。order_index は受け取らない（並べ替えは <see cref="MoveTaskRequest"/> の担当）。
    /// クライアントが持つ order_index はサーバーの採番・振り直しの後では古くなっているため、
    /// 編集のたびに書き戻させると、直したばかりの並びを古い値で壊してしまう。
    /// </summary>
    public class UpdateTaskRequest
    {
        public Guid? PositionId { get; set; }
        public Guid? CategoryId { get; set; }
        public Guid? AssigneeId { get; set; }
        [MaxLength(TextLimits.TaskName)]
        public string Name { get; set; } = string.Empty;
        [MaxLength(TextLimits.TaskComment)]
        public string? Comment { get; set; }
        [Range(TextLimits.ImportanceMin, TextLimits.ImportanceMax)]
        public int? Importance { get; set; }
        public DateOnly? Deadline { get; set; }
    }

    /// <summary>
    /// タスクの移動（並べ替え）。order_index の値そのものではなく「どこへ入れたいか」を送る。
    /// 採番はサーバーが行う（<see cref="Data.ITaskRepository.MoveAsync"/>）。
    /// PrevTaskId / NextTaskId は移動先での両隣。先頭なら Prev が null、末尾なら Next が null、
    /// 空のカラムへ入れるなら両方 null。
    /// </summary>
    public class MoveTaskRequest
    {
        public Guid? PositionId { get; set; }
        public Guid? PrevTaskId { get; set; }
        public Guid? NextTaskId { get; set; }
    }
}
