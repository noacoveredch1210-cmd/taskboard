import { test, expect, type Locator, type Page } from "@playwright/test";
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

/** 3 列にするテストでだけ使う真ん中の列。 */
const POS_DOING = "20000000-0000-4000-8000-000000000003";

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

test("カードのある列の余白へ落とすと、末尾ではなく先頭に入る", async ({
  page,
}) => {
  await signIn(page);
  const state = defaultState();
  // A は Todo、B は Done。B が居る Done の余白へ A を落とす。
  state.tasks = [
    { ...state.tasks[0], id: TASK_A, name: "タスクA", orderIndex: 0 },
    { ...state.tasks[0], id: TASK_B, name: "タスクB", positionId: POS_DONE, orderIndex: 0 },
  ];
  const api = await stubApi(page, state);
  await openBoard(page);
  api.clear();

  // Done 列の下の方（カードの無い余白）へ落とす。
  const done = await column(page, POS_DONE).boundingBox();
  const a = await task(page, TASK_A).boundingBox();
  if (!done || !a) throw new Error("見つかりません");

  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 20, a.y + a.height / 2, {
    steps: 5,
  });
  await page.mouse.move(done.x + done.width / 2, done.y + done.height - 40, {
    steps: 10,
  });
  await page.mouse.up();

  // A が B より前（先頭）に入る。
  await expect(
    column(page, POS_DONE).getByTestId(/^task-/).first(),
  ).toHaveAttribute("data-testid", `task-${TASK_A}`);

  // 先頭なので、隣（B の 0）より小さい order_index が採番される。
  const puts = api.find("PUT", "/tasks/");
  expect(puts).toHaveLength(1);
  expect((puts[0].body as { orderIndex: number }).orderIndex).toBeLessThan(0);
});

test("3 列のとき、一番右のカードを空の真ん中の列へドラッグできる", async ({
  page,
}) => {
  await signIn(page);
  const state = defaultState();
  // 3 列にして、カードは一番右の列だけに置く。
  state.positions = [
    { id: POS_TODO, boardId: BOARD_ID, name: "Todo", orderIndex: 0 },
    { id: POS_DOING, boardId: BOARD_ID, name: "Doing", orderIndex: 1 },
    { id: POS_DONE, boardId: BOARD_ID, name: "Done", orderIndex: 2 },
  ];
  state.tasks = [{ ...state.tasks[0], positionId: POS_DONE }];
  const api = await stubApi(page, state);
  await openBoard(page);

  await expect(column(page, POS_DONE)).toContainText("タスクA");
  api.clear();

  await dragOnto(page, task(page, TASK_A), column(page, POS_DOING));

  await expect(column(page, POS_DOING)).toContainText("タスクA");
  await expect(column(page, POS_DONE)).not.toContainText("タスクA");

  const puts = api.find("PUT", "/tasks/");
  expect(puts).toHaveLength(1);
  expect(puts[0].body).toMatchObject({ positionId: POS_DOING });
});

test("列を広げてカードが横に並ぶとき、右端のカードを真ん中へドラッグできる", async ({
  page,
}) => {
  await signIn(page);
  const state = defaultState();
  // 同じ列に 3 枚。列を広げると横 3 枚のグリッドになる。
  state.tasks = [
    { ...state.tasks[0], id: TASK_A, name: "タスクA", orderIndex: 0 },
    { ...state.tasks[0], id: TASK_B, name: "タスクB", orderIndex: 1 },
    { ...state.tasks[0], id: TASK_C, name: "タスクC", orderIndex: 2 },
  ];
  await stubApi(page, state);
  await openBoard(page);

  // 右端のハンドルをドラッグして Todo 列を広げる。
  const handle = page.getByTestId("column-resize-handle").first();
  const h = await handle.boundingBox();
  if (!h) throw new Error("リサイズハンドルが見つかりません");
  await page.mouse.move(h.x + h.width / 2, h.y + 100);
  await page.mouse.down();
  await page.mouse.move(h.x + 360, h.y + 100, { steps: 10 });
  await page.mouse.up();

  // 3 枚が同じ行に並んだことを確かめる（前提が崩れたら気づけるように）。
  const boxA = await task(page, TASK_A).boundingBox();
  const boxC = await task(page, TASK_C).boundingBox();
  if (!boxA || !boxC) throw new Error("カードが見つかりません");
  expect(boxC.y).toBe(boxA.y);
  expect(boxC.x).toBeGreaterThan(boxA.x);

  // 右端の C を、真ん中の B の「中心」へドラッグする（利用者の操作そのもの）。
  const boxB = await task(page, TASK_B).boundingBox();
  if (!boxB) throw new Error("カードが見つかりません");
  await page.mouse.move(boxC.x + boxC.width / 2, boxC.y + boxC.height / 2);
  await page.mouse.down();
  await page.mouse.move(boxC.x + boxC.width / 2 - 20, boxC.y + boxC.height / 2, {
    steps: 5,
  });
  // 縦に数 px ずれるのは普通の操作。前後がそれで変わってはいけない。
  await page.mouse.move(boxB.x + boxB.width / 2, boxB.y + boxB.height / 2 + 5, {
    steps: 10,
  });
  await page.mouse.up();

  // C が真ん中（2 番目）に入る。
  await expect(
    column(page, POS_TODO).getByTestId(/^task-/).nth(1),
  ).toHaveAttribute("data-testid", `task-${TASK_C}`);
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
