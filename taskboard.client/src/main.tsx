import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { ToastProvider } from "./components/toast/ToastContext";
import ErrorBoundary from "./components/ErrorBoundary";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* Provider より外側に置き、認証・トースト側の例外も拾えるようにする */}
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);
