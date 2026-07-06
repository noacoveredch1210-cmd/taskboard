import { createClient } from "@supabase/supabase-js";

// Supabase プロジェクトの URL と anon キー。
// ダッシュボード Settings → API から取得し、.env に設定する。
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY が未設定です。.env を確認してください。",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
