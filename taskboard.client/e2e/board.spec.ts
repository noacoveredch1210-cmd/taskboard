import { test, expect, type Locator, type Page } from "@playwright/test";
import { signIn } from "./fixtures/auth";
import { stubApi, POS_DONE, POS_TODO, TASK_A, TASK_B } from "./fixtures/api";

const column = (page: Page, positionId: string) =>
  page.getByTestId(`col-${positionId}`);

const task = (page: Page, taskId: string) => page.getByTestId(`task-${taskId}`);

/**
 * サイドバーのボタンからボードを開く。
 * （ホーム画面のボードカードをクリックすると、開くのではなく編集モーダルが出る）
 */
const openBoard = async (page: Page) => {
  await page.goto("/");
  await page.getByRole("button", { name: "list_alt_check E2E" }).click();
  await expect(column(page, POS_TODO)).toBeVisible();
};

/**
 * dnd-kit の PointerSensor は 8px 動くまでドラッグを開始しない。
 * また dragOver を発火させるため、座標を刻んで動かす。
 */
const dragOnto = async (page: Page, from: Locator, to: Locator) => {
  const source = await from.boundingBox();
  const target = await to.boundingBox();
  if (!source || !target) throw new Error("ドラッグ対象が画面に見つかりません");

  const startX = source.x + source.width / 2;
  const startY = source.y + source.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // 起動しきい値(8px)を確実に超える
  await page.mouse.move(startX + 20, startY, { steps: 5 });
  await page.mouse.move(target.x + target.width / 2, target.y + 30, {
    steps: 10,
  });
  await page.mouse.up();
};

test("タスクを別の列へドラッグすると、その列に移り、動いた 1 件だけが保存される", async ({
  page,
}) => {
  await signIn(page);
  const api = await stubApi(page);
  await openBoard(page);

  // 最初は 2 件とも Todo 列にある。
  await expect(column(page, POS_TODO)).toContainText("タスクA");
  await expect(column(page, POS_DONE)).not.toContainText("タスクA");
  api.clear();

  await dragOnto(page, task(page, TASK_A), column(page, POS_DONE));

  await expect(column(page, POS_DONE)).toContainText("タスクA");
  await expect(column(page, POS_TODO)).not.toContainText("タスクA");
  await expect(column(page, POS_TODO)).toContainText("タスクB");

  // 連番方式なら後続の行も PUT されるが、中間値方式なので 1 件だけ。
  const puts = api.find("PUT", "/tasks/");
  expect(puts).toHaveLength(1);
  expect(puts[0].path).toBe(`/tasks/${TASK_A}`);
  expect(puts[0].body).toMatchObject({ positionId: POS_DONE });
});

test("同じ列の中で並べ替えると、動いたタスクだけが保存される", async ({
  page,
}) => {
  await signIn(page);
  const api = await stubApi(page);
  await openBoard(page);
  api.clear();

  // B を A の上へ持っていく。
  const a = await task(page, TASK_A).boundingBox();
  const b = await task(page, TASK_B).boundingBox();
  if (!a || !b) throw new Error("タスクが見つかりません");

  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 - 20, {
    steps: 5,
  });
  await page.mouse.move(a.x + a.width / 2, a.y + 2, { steps: 10 });
  await page.mouse.up();

  // 表示順が入れ替わる。
  await expect(column(page, POS_TODO).getByTestId(/^task-/).first()).toHaveAttribute(
    "data-testid",
    `task-${TASK_B}`,
  );

  const puts = api.find("PUT", "/tasks/");
  expect(puts).toHaveLength(1);
  expect(puts[0].path).toBe(`/tasks/${TASK_B}`);
  // 先頭へ移したので、隣（A の 0）より小さい order_index が採番される。
  expect((puts[0].body as { orderIndex: number }).orderIndex).toBeLessThan(0);
});

test("保存に失敗したら通知を出し、サーバーの状態へ巻き戻す", async ({ page }) => {
  await signIn(page);
  // タスクの更新だけ 500 にする。巻き戻しのための再取得（GET）は成功させる。
  await stubApi(page, undefined, {
    failWhen: (method, path) => method === "PUT" && path.startsWith("/tasks/"),
  });
  await openBoard(page);

  await dragOnto(page, task(page, TASK_A), column(page, POS_DONE));

  await expect(page.getByTestId("toast")).toContainText(
    "タスクの並び順の保存に失敗しました",
  );

  // サーバーの状態（A も B も Todo 列）へ戻る。
  await expect(column(page, POS_TODO)).toContainText("タスクA");
  await expect(column(page, POS_DONE)).not.toContainText("タスクA");
});

test("通信が切れていて再取得もできないときも、ドラッグ前の並びへ戻す", async ({
  page,
}) => {
  await signIn(page);
  // 初期ロードは成功させ、ボードを開いたあとに通信を落とす。
  let offline = false;
  await stubApi(page, undefined, { failWhen: () => offline });
  await openBoard(page);

  offline = true;
  await dragOnto(page, task(page, TASK_A), column(page, POS_DONE));

  await expect(page.getByTestId("toast")).toBeVisible();
  // 再取得もできないので、操作前のスナップショットへ戻る。
  await expect(column(page, POS_TODO)).toContainText("タスクA");
  await expect(column(page, POS_DONE)).not.toContainText("タスクA");
});
