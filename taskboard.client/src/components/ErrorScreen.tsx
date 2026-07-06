type Props = {
  onRetry: () => void;
};

/** 初期データの取得に失敗したときに全画面で表示するエラー画面。 */
const ErrorScreen = ({ onRetry }: Props) => {
  return (
    <div className="flex h-dvh items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4 rounded-lg border bg-white px-10 py-12 shadow-sm">
        <span className="material-symbols-outlined text-5xl! text-gray-400">
          cloud_off
        </span>
        <h1 className="text-xl font-bold">データを取得できませんでした</h1>
        <p className="text-sm text-gray-500">
          サーバーに接続できませんでした。時間をおいて再度お試しください。
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded bg-primary-button px-6 py-2 font-medium hover:bg-primary-button-hover"
        >
          再読み込み
        </button>
      </div>
    </div>
  );
};

export default ErrorScreen;
