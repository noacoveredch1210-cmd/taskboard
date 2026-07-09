using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace TaskBoard.Server.Tests.Support
{
    /// <summary>
    /// 認証済みリクエストを模すためのヘルパー。
    /// 本番では JwtBearer が組み立てる ClaimsPrincipal を、テストでは直接差し込む。
    /// </summary>
    internal static class ControllerTestExtensions
    {
        /// <summary>sub クレームに <paramref name="userId"/> を持つユーザーとして振る舞わせる。</summary>
        public static T WithUser<T>(this T controller, Guid userId, params Claim[] extraClaims)
            where T : ControllerBase
        {
            var claims = new List<Claim> { new("sub", userId.ToString()) };
            claims.AddRange(extraClaims);
            return controller.WithClaims([.. claims]);
        }

        /// <summary>任意のクレーム構成のユーザーとして振る舞わせる。</summary>
        public static T WithClaims<T>(this T controller, params Claim[] claims)
            where T : ControllerBase
        {
            // Program.cs の MapInboundClaims = false / NameClaimType = "sub" に合わせる。
            var identity = new ClaimsIdentity(claims, "TestAuth", "sub", ClaimTypes.Role);
            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) },
            };
            return controller;
        }
    }
}
