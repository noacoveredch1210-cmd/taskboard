type Props = {
  onRetry: () => void;
  /** 既定は初期取得の失敗向けの文言。予期しないエラーなど、用途に応じて差し替える。 */
  icon?: string;
  title?: string;
  message?: string;
};

/** 復帰できない状態を全画面で伝える画面。初期取得の失敗と、予期しない例外で使う。 */
const ErrorScreen = ({
  onRetry,
  icon = "cloud_off",
  title = "データを取得できませんでした",
  message = "サーバーに接続できませんでした。時間をおいて再度お試しください。",
}: Props) => {
  return (
    <div className="flex h-dvh items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4 rounded-lg border bg-white px-10 py-12 shadow-sm">
        <span className="cursor-default material-symbols-outlined text-5xl! text-gray-400">
          {icon}
        </span>
        <h1 className="cursor-default text-xl font-bold">{title}</h1>
        <p className="cursor-default text-sm text-gray-500">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="cursor-pointer mt-2 rounded bg-primary-button px-6 py-2 font-medium hover:bg-primary-button-hover"
        >
          再読み込み
        </button>
      </div>
    </div>
  );
};

export default ErrorScreen;
