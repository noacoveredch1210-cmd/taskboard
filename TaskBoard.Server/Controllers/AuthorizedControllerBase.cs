using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace TaskBoard.Server.Controllers
{
    /// <summary>
    /// 認証必須のコントローラー共通基底。
    /// 各エンドポイントは Supabase JWT の検証を通過したユーザーだけがアクセスでき、
    /// 操作対象のユーザー ID はトークンの sub クレームから取得する
    /// （クライアントが送ってくる userId は信用しない）。
    /// </summary>
    [Authorize]
    [ApiController]
    public abstract class AuthorizedControllerBase : ControllerBase
    {
        /// <summary>認証済みユーザーの ID（Supabase JWT の sub クレーム）。</summary>
        protected Guid CurrentUserId =>
            Guid.TryParse(User.FindFirstValue("sub"), out var id)
                ? id
                : throw new InvalidOperationException("認証トークンに有効な 'sub' クレームがありません。");
    }
}
