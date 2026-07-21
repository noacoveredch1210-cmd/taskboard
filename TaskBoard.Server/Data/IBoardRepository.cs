using TaskBoard.Server.Models;

namespace TaskBoard.Server.Data
{
    /// <summary>共有トークンでの参加リクエストの結果。</summary>
    public enum JoinResult
    {
        NotFound,
        AlreadyMember,
        Requested,
    }

    /// <summary>参加リクエストの結果と、対象ボードの id（トークンが有効なとき）。</summary>
    public record JoinOutcome(JoinResult Result, Guid? BoardId);

    /// <summary>
    /// board は複数ユーザーで共有される。アクセス権は board_members で判定し、
    /// メンバーでない board には触れられない（該当しなければ null / false を返す）。
    /// </summary>
    public interface IBoardRepository
    {
        /// <summary>ユーザーが参加している board 一覧（自分の役割付き）。</summary>
        Task<IEnumerable<Board>> GetForUserAsync(Guid userId);
        /// <summary>
        /// 参加している全ボードを中身（列・タスク・カテゴリー・メンバー）ごと返す。
        /// 画面はどのみち全部使うので、1 リクエストで返してクライアントの N+1 を無くす。
        /// </summary>
        Task<IEnumerable<BoardDetail>> GetDetailsForUserAsync(Guid userId);
        Task<Board?> GetByIdAsync(Guid id, Guid userId);
        /// <summary>board を作成し、作成者を owner としてメンバー登録する。</summary>
        Task CreateAsync(CreateBoardRequest request);
        /// <summary>メンバーなら board を更新する。</summary>
        Task<bool> UpdateAsync(Guid id, Guid userId, UpdateBoardRequest request);
        /// <summary>オーナーなら board を削除する。</summary>
        Task<bool> DeleteAsync(Guid id, Guid userId);

        // ---- 共有・メンバー管理 ----

        /// <summary>オーナーだけが取得できる共有トークン。メンバーでない/オーナーでないなら null。</summary>
        Task<Guid?> GetShareTokenAsync(Guid boardId, Guid userId);
        /// <summary>
        /// 共有トークンで参加リクエストを出す。即メンバーにはならず、オーナーの承認を待つ。
        /// トークンが無効なら NotFound、既にメンバーなら AlreadyMember、それ以外は Requested。
        /// </summary>
        Task<JoinOutcome> RequestJoinByTokenAsync(Guid token, Guid userId);
        /// <summary>保留中の参加リクエスト一覧（オーナーのみ）。</summary>
        Task<IEnumerable<BoardMember>> GetJoinRequestsAsync(Guid boardId, Guid userId);
        /// <summary>参加リクエストを承認してメンバーにする（オーナーのみ）。</summary>
        Task<bool> ApproveJoinRequestAsync(Guid boardId, Guid actingUserId, Guid targetUserId);
        /// <summary>参加リクエストを却下する（オーナーのみ）。</summary>
        Task<bool> RejectJoinRequestAsync(Guid boardId, Guid actingUserId, Guid targetUserId);
        /// <summary>メンバー一覧（メンバーのみ取得可）。</summary>
        Task<IEnumerable<BoardMember>> GetMembersAsync(Guid boardId, Guid userId);
        /// <summary>
        /// メンバーを外す。オーナーは他のメンバーを外せる。本人はいつでも退出できるが、
        /// 最後の 1 人のオーナーは退出できない（他人のオーナーを外すこともできない）。
        /// </summary>
        Task<bool> RemoveMemberAsync(Guid boardId, Guid actingUserId, Guid targetUserId);
        /// <summary>
        /// メンバーの役割を変える（オーナーのみ）。最後の 1 人のオーナーは降格できない。
        /// </summary>
        Task<bool> SetMemberRoleAsync(Guid boardId, Guid actingUserId, Guid targetUserId, string role);
    }
}
