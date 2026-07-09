import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import ToastViewport from "./ToastViewport";

export type Toast = { id: string; message: string };

type ToastContextValue = {
  /** 画面右下に通知を出す。一定時間で自動的に消える。 */
  showToast: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

/** 通知が自動で消えるまでの時間 */
export const TOAST_DURATION_MS = 5000;

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, message }]);
      window.setTimeout(() => dismiss(id), TOAST_DURATION_MS);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast は ToastProvider の内側で使ってください。");
  return ctx;
};
