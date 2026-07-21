import { test, expect } from "@playwright/test";
import { signIn } from "./fixtures/auth";
import { stubApi, defaultState } from "./fixtures/api";

/**
 * 起動時の API リクエスト数が board 枚数に比例して増えないことを確かめる。
 *
 * 以前は board ごとに positions / tasks / categories / members を引いていたため
 * 1+4N 本になり、board が増えるほど起動が遅く、画面へ戻るたびの再取得だけで
 * レート制限（100 回/分）を使い切ってしまった。
 */
test("起動時のリクエスト数は board 枚数に比例しない", async ({ page }) => {
  await signIn(page);

  // board を 5 枚にする（旧実装なら 1+4×5=21 本になっていた）。
  const state = defaultState();
  state.boards = Array.from({ length: 5 }, (_, i) => ({
    id: `1000000${i}-0000-4000-8000-000000000001`,
    shortName: `B${i}`,
    title: `ボード${i}`,
    role: "owner" as const,
  }));
  state.positions = state.boards.map((b, i) => ({
    id: `2000000${i}-0000-4000-8000-000000000001`,
    boardId: b.id,
    name: "Todo",
    orderIndex: 0,
  }));
  state.tasks = [];
  await stubApi(page, state);

  const apiCalls: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) apiCalls.push(url.pathname);
  });

  await page.goto("/");
  await expect(page.getByText("ボード0")).toBeVisible();

  // 肝心なのは「board ごとの追加リクエストが無い」こと。
  // 旧実装ではここが board 枚数ぶん（5 本ずつ）並んでいた。
  expect(apiCalls.filter((p) => p === "/api/positions")).toHaveLength(0);
  expect(apiCalls.filter((p) => p === "/api/tasks")).toHaveLength(0);
  expect(apiCalls.filter((p) => p === "/api/categories")).toHaveLength(0);
  expect(apiCalls.filter((p) => p.endsWith("/members"))).toHaveLength(0);

  // 一覧の取得は 1 本。StrictMode（開発時）は effect を 2 回走らせるが、
  // 取得中フラグで 1 本に絞られる。
  expect(apiCalls.filter((p) => p === "/api/boards")).toHaveLength(1);

  console.log(`\n=== 起動時の API リクエスト: ${apiCalls.length} 本（board 5 枚）===\n`);
});
