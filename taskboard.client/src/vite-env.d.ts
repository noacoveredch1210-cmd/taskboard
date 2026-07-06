/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** バックエンド API のベース URL（例: http://localhost:5000/api） */
  readonly VITE_API_BASE_URL?: string;
  /** Supabase プロジェクト URL（例: https://xxxx.supabase.co） */
  readonly VITE_SUPABASE_URL: string;
  /** Supabase anon（公開）API キー */
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
