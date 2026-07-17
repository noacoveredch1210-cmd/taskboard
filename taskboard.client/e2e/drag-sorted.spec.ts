import { test, expect } from "@playwright/test";
import { signIn } from "./fixtures/auth";
import { stubApi, defaultState, TASK_A, TASK_B } from "./fixtures/api";

/**
 * 「ドラッグしていると画面が真っ白になる」の再現。
 *
 * 表示は sortKey で並び替えるが、D&D は生の配列を動かす。生の並びを変えても
 * 表示順が変わらない状況だと、カーソルの下のカードが変わらないまま
 * 判定がやり直され、更新が止まらなくなる（Maximum update depth exceeded）。
 */
test("表示を並び替えた状態で同じ列のカードへドラッグしても、更新が止まらなくならない", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await signIn(page);
  const state = defaultState();
  // 生の並びは [B, A]。重要度で並べ替えると表示は [A, B] になる。
  state.tasks = [
    { ...state.tasks[0], id: TASK_B, name: "タスクB", importance: 0, orderIndex: 0 },
    { ...state.tasks[0], id: TASK_A, name: "タスクA", importance: 2, orderIndex: 1 },
  ];
  await stubApi(page, state);

  await page.goto("/");
  await page.getByRole("button", { name: "list_alt_check E2E" }).click();
  await expect(page.getByTestId(`task-${TASK_A}`)).toBeVisible();

  // 「重要度-高」で並び替える（表示 [A, B]、生の並び [B, A]）。
  await page.getByRole("combobox").first().selectOption("importance-desc");

  const a = await page.getByTestId(`task-${TASK_A}`).boundingBox();
  const b = await page.getByTestId(`task-${TASK_B}`).boundingBox();
  if (!a || !b) throw new Error("カードが見つかりません");

  // B を A の上へ運んで静止する。
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 - 20, {
    steps: 5,
  });
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2, { steps: 10 });
  await page.waitForTimeout(500);
  await page.mouse.up();

  // アプリが生きている（真っ白になっていない）。
  await expect(page.getByTestId(/^task-/)).toHaveCount(2);
  expect(errors).toEqual([]);
});
