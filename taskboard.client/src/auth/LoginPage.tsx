import { useState } from "react";
import { useAuth } from "./AuthContext";

const LoginPage = () => {
  const { signInWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    try {
      await signInWithGoogle();
    } catch {
      setError("ログインに失敗しました。時間をおいて再度お試しください。");
    }
  };

  return (
    <div className="flex h-dvh items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-6 rounded-lg border bg-white px-10 py-12 shadow-sm">
        <h1 className="text-2xl font-bold">TaskBoard</h1>
        <p className="text-sm text-gray-500">続けるにはログインしてください</p>
        <button
          type="button"
          onClick={handleLogin}
          className="flex items-center gap-3 rounded border px-6 py-2.5 font-medium hover:bg-gray-100"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A9 9 0 0 0 9 18z"
            />
            <path
              fill="#FBBC05"
              d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.01-2.34z"
            />
            <path
              fill="#EA4335"
              d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58z"
            />
          </svg>
          Google でログイン
        </button>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    </div>
  );
};

export default LoginPage;
