import { test, expect } from "@playwright/test";
import { signIn } from "./fixtures/auth";
import { stubApi, defaultState, BOARD_ID, POS_TODO } from "./fixtures/api";

/**
 * ドラッグ中の「重さ」を React のコミット回数で測る。
 * DevTools のフックを React より先に仕込むと、コミットごとに呼ばれる。
 * 断定を避けるため、閾値ではなく実測値を出力する。
 */
test("ドラッグ中の React コミット回数を測る", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__commits = 0;
    w.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      isDisabled: false,
      supportsFiber: true,
      renderers: new Map(),
      inject: () => 1,
      checkDCE: () => {},
      onCommitFiberRoot: () => {
        w.__commits = (w.__commits as number) + 1;
      },
      onCommitFiberUnmount: () => {},
      onPostCommitFiberRoot: () => {},
    };
  });

  await signIn(page);
  const state = defaultState();
  // 30 枚を 1 列に置く（実際のボードに近い量）。
  state.tasks = Array.from({ length: 30 }, (_, i) => ({
    ...state.tasks[0],
    id: `30000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    name: `タスク${i}`,
    boardId: BOARD_ID,
    positionId: POS_TODO,
    orderIndex: i,
  }));
  await stubApi(page, state);

  await page.goto("/");
  await page.getByRole("button", { name: "list_alt_check E2E" }).click();
  await expect(page.getByTestId(/^task-/).first()).toBeVisible();

  const first = await page.getByTestId(/^task-/).first().boundingBox();
  const last = await page.getByTestId(/^task-/).nth(9).boundingBox();
  if (!first || !last) throw new Error("カードが見つかりません");

  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).__commits = 0;
  });

  // CDP でスクリプト実行時間を測る（コミット「回数」ではなく仕事量を見る）。
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  const scriptDuration = async () => {
    const { metrics } = await cdp.send("Performance.getMetrics");
    return metrics.find((m) => m.name === "ScriptDuration")?.value ?? 0;
  };
  const scriptBefore = await scriptDuration();

  const start = Date.now();
  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
  await page.mouse.down();
  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2 + 20, { steps: 5 });
  // 同じ列の中を下へゆっくり動かす（利用者の「並べ替え」操作）。
  await page.mouse.move(last.x + last.width / 2, last.y + last.height / 2, {
    steps: 40,
  });
  await page.mouse.up();
  const elapsed = Date.now() - start;

  const script = (await scriptDuration()) - scriptBefore;
  const commits = await page.evaluate(
    () => (window as unknown as Record<string, number>).__commits,
  );
  console.log(
    `\n=== ドラッグ中: コミット ${commits} 回 / JS実行 ${(script * 1000).toFixed(0)}ms / 経過 ${elapsed}ms ===\n`,
  );
  expect(commits).toBeGreaterThan(0);
});
