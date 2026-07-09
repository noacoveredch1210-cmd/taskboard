namespace TaskBoard.Server.Models
{
    /// <summary>
    /// 各テキスト入力の最大文字数。
    /// taskboard.client/src/constants/textLimits.ts と同じ値を保つこと
    /// （フロントは maxLength で入力を止め、サーバーはリクエストを 400 で弾く）。
    /// </summary>
    public static class TextLimits
    {
        public const int BoardTitle = 30;
        public const int BoardShortName = 10;
        public const int PositionName = 8;
        public const int CategoryName = 15;
        public const int TaskName = 40;
        public const int TaskComment = 500;

        /// <summary>フロントの &lt;input type="color"&gt; が返す "#rrggbb" 形式。</summary>
        public const string HexColorPattern = "^#[0-9a-fA-F]{6}$";

        /// <summary>重要度は「なし(0)」から「高(3)」まで。</summary>
        public const int ImportanceMin = 0;
        public const int ImportanceMax = 3;

        /// <summary>ユーザー名とメールアドレス。Supabase の JWT クレーム由来で、UI からは入力しない。</summary>
        public const int UserName = 100;
        public const int UserEmail = 254;
    }
}
