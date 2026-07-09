/**
 * API 呼び出しの失敗を開発者向けにログするヘルパー。
 *
 * ユーザーへの通知と state の巻き戻しは各フックの handleFailure が行う。
 * これ単体で使ってよいのは、失敗しても UI 側で別途手当てがある場合だけ
 * （初回ロードの失敗はエラー画面が受け持つ）。
 */
export const reportError = (message: string) => (err: unknown) =>
  console.error(message, err);
