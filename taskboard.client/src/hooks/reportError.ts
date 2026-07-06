/**
 * API 呼び出しの失敗をログするヘルパー。
 * オプティミスティック更新のため、UI は既に更新済み。失敗はログのみで握りつぶす。
 */
export const reportError = (message: string) => (err: unknown) =>
  console.error(message, err);
