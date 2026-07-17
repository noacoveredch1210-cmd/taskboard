import { test, expect } from "@playwright/test";
import { signIn } from "./fixtures/auth";
import {
  stubApi,
  defaultState,
  BOARD_ID,
  POS_DONE,
  POS_TODO,
  TASK_A,
  TASK_B,
  TASK_C,
} from "./fixtures/api";

const POS_DOING = "20000000-0000-4000-8000-000000000003";

/**
 * 「ドラッグしていると画面が真っ白になる」の再現用。
 * 描画中に例外が出ると React はツリーを unmount するため、pageerror を拾う。
 */
test("列をまたいでドラッグを往復しても、例外が出ずカードが消えない", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await signIn(page);
  const state = defaultState();
  state.positions = [
    { id: POS_TODO, boardId: BOARD_ID, name: "Todo", orderIndex: 0 },
    { id: POS_DOING, boardId: BOARD_ID, name: "Doing", orderIndex: 1 },
    { id: POS_DONE, boardId: BOARD_ID, name: "Done", orderIndex: 2 },
  ];
  // 実データに寄せる（カテゴリー・期限・担当者・重要度あり）。
  const CAT = "40000000-0000-4000-8000-000000000001";
  state.categories = [{ id: CAT, name: "開発", color: "#4F7C7E" }];
  state.tasks = [
    {
      ...state.tasks[0],
      id: TASK_A,
      name: "タスクA",
      categoryId: CAT,
      deadline: "2026-08-01",
      importance: 2,
      orderIndex: 0,
    },
    {
      ...state.tasks[0],
      id: TASK_B,
      name: "タスクB",
      positionId: POS_DOING,
      categoryId: CAT,
      deadline: "2026-08-02",
      importance: 1,
      orderIndex: 1,
    },
    {
      ...state.tasks[0],
      id: TASK_C,
      name: "タスクC",
      positionId: POS_DOING,
      categoryId: CAT,
      deadline: "2026-08-03",
      importance: 0,
      orderIndex: 2,
    },
  ];
  await stubApi(page, state);

  await page.goto("/");
  await page.getByRole("button", { name: "list_alt_check E2E" }).click();
  await expect(page.getByTestId(`col-${POS_TODO}`)).toBeVisible();

  const box = await page.getByTestId(`task-${TASK_A}`).boundingBox();
  // 移動先の列には既にカードがある（B と C）。空の列だと振動しない。
  const b = await page.getByTestId(`task-${TASK_B}`).boundingBox();
  const c = await page.getByTestId(`task-${TASK_C}`).boundingBox();
  if (!box || !b || !c) throw new Error("見つかりません");

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();

  // 別の列のカードの上へ運び、そこで静止する。
  // ライブ並べ替え→再計測→再判定 が繰り返されるので、判定が振動すると
  // ポインタを動かさなくても setState が入れ子で走り続ける。
  for (const target of [b, c, b, c]) {
    for (const dy of [10, -10, 30, -30]) {
      await page.mouse.move(
        target.x + target.width / 2,
        target.y + target.height / 2 + dy,
        { steps: 6 },
      );
      await page.waitForTimeout(150);
    }
  }
  await page.mouse.up();

  // アプリが生きていて、3 枚とも残っている。
  await expect(page.getByTestId(/^task-/)).toHaveCount(3);
  expect(errors).toEqual([]);
});
