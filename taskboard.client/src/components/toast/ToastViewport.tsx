import type { Toast } from "./ToastContext";

type Props = {
  toasts: Toast[];
  onDismiss: (id: string) => void;
};

/**
 * 画面右下に通知を積み上げて表示する。
 * 操作の失敗を伝えるため、支援技術にも読み上げられるよう live region にする。
 */
const ToastViewport = ({ toasts, onDismiss }: Props) => {
  return (
    <div
      // 通知が無いときも live region を DOM に残す（後から現れた領域は読み上げられない）
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          data-testid="toast"
          className="flex items-center gap-3 rounded border border-red-200 bg-white px-4 py-3 shadow-lg"
        >
          <span className="material-symbols-outlined text-red-500">error</span>
          <span className="text-sm">{toast.message}</span>
          <button
            type="button"
            aria-label="通知を閉じる"
            onClick={() => onDismiss(toast.id)}
            className="ml-2 rounded px-1 hover:bg-gray-100 pt-1"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastViewport;
