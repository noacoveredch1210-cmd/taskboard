using System.ComponentModel.DataAnnotations;

namespace TaskBoard.Server.Models
{
    public class CreateBoardRequest
    {
        public Guid Id { get; set; }
        /// <summary>コントローラーがトークンのユーザー ID で上書きするため、body の値は使われない。</summary>
        public Guid UserId { get; set; }
        [MaxLength(TextLimits.BoardShortName)]
        public string ShortName { get; set; } = string.Empty;
        [MaxLength(TextLimits.BoardTitle)]
        public string Title { get; set; } = string.Empty;
    }

    public class UpdateBoardRequest
    {
        [MaxLength(TextLimits.BoardShortName)]
        public string ShortName { get; set; } = string.Empty;
        [MaxLength(TextLimits.BoardTitle)]
        public string Title { get; set; } = string.Empty;
        /// <summary>
        /// 列の「あるべき姿」を丸ごと送る（配列順がそのまま表示順になる）。
        /// 送られてこなかった既存の列は削除される。null なら列には触れない。
        /// </summary>
        public List<BoardPositionRequest>? Positions { get; set; }
    }

    /// <summary>ボード編集で送る列。順序は配列の位置で決まるので order_index は持たない。</summary>
    public class BoardPositionRequest
    {
        public Guid Id { get; set; }
        [MaxLength(TextLimits.PositionName)]
        public string Name { get; set; } = string.Empty;
    }
}
