import type { Page } from "@playwright/test";

/**
 * Google OAuth は自動化できないため、E2E では supabase-js が読む localStorage へ
 * 直接セッションを書き込んでログイン済みの状態を作る。
 *
 * キーは supabase-js の既定値 `sb-<ホスト名の先頭ラベル>-auth-token` に一致させる。
 * .env.e2e で VITE_SUPABASE_URL=http://localhost:54321 としているので "localhost"。
 */
const STORAGE_KEY = "sb-localhost-auth-token";

export const TEST_USER = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "e2e@example.com",
  name: "E2E ユーザー",
};

/** 署名は検証されない（API はスタブ）が、デコードされても壊れない形にしておく。 */
const fakeAccessToken = (expiresAt: number): string => {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const header = encode({ alg: "ES256", typ: "JWT" });
  const payload = encode({
    sub: TEST_USER.id,
    email: TEST_USER.email,
    aud: "authenticated",
    role: "authenticated",
    exp: expiresAt,
    user_metadata: { full_name: TEST_USER.name },
  });
  return `${header}.${payload}.e2e-signature-not-verified`;
};

/** ログイン済みの状態でページを開けるようにする。goto より前に呼ぶこと。 */
export const signIn = async (page: Page) => {
  // 期限切れだと supabase-js がトークン更新の通信を試みるため、十分先に置く。
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24;

  const session = {
    access_token: fakeAccessToken(expiresAt),
    token_type: "bearer",
    expires_in: 60 * 60 * 24,
    expires_at: expiresAt,
    refresh_token: "e2e-refresh-token",
    user: {
      id: TEST_USER.id,
      aud: "authenticated",
      role: "authenticated",
      email: TEST_USER.email,
      app_metadata: { provider: "google" },
      user_metadata: { full_name: TEST_USER.name },
      created_at: new Date().toISOString(),
    },
  };

  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [STORAGE_KEY, JSON.stringify(session)] as const,
  );

  // Supabase 本体へは一切通信しない（誤って本番を叩かないための安全弁）。
  await page.route("**://localhost:54321/**", (route) => route.abort());
};
