import { test, expect, type Page } from "@playwright/test";
import { signIn } from "./fixtures/auth";
import { stubApi, POS_TODO, TASK_A } from "./fixtures/api";

/**
 * useDialogController は <dialog> の showModal / cancel / backdrop クリックに依存する。
 * jsdom は showModal も backdrop も持たないため、ここは実ブラウザでしか確かめられない。
 */

const openBoard = async (page: Page) => {
  await page.goto("/");
  await page.getByRole("button", { name: "list_alt_check E2E" }).click();
  await expect(page.getByTestId(`col-${POS_TODO}`)).toBeVisible();
};

const openTaskModal = async (page: Page) => {
  await page.getByTestId(`task-${TASK_A}`).click();
  const dialog = page.locator("dialog[open]");
  await expect(dialog).toBeVisible();
  return dialog;
};

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await stubApi(page);
  await openBoard(page);
});

test("タスクをクリックすると、その内容を入れたモーダルが開く", async ({
  page,
}) => {
  const dialog = await openTaskModal(page);

  // タスク名は編集用の入力欄の値として入っている。
  await expect(dialog.getByRole("textbox").first()).toHaveValue("タスクA");
});

test("Esc でモーダルを閉じる", async ({ page }) => {
  await openTaskModal(page);

  await page.keyboard.press("Escape");

  await expect(page.locator("dialog[open]")).toHaveCount(0);
});

test("背景（バックドロップ）のクリックでモーダルを閉じる", async ({ page }) => {
  const dialog = await openTaskModal(page);
  const box = await dialog.boundingBox();
  if (!box) throw new Error("モーダルが見つかりません");

  // ダイアログ矩形の外側 = バックドロップ。左上の隅より外を狙う。
  await page.mouse.click(Math.max(box.x - 40, 5), Math.max(box.y - 40, 5));

  await expect(page.locator("dialog[open]")).toHaveCount(0);
});

test("モーダルの内側をクリックしても閉じない", async ({ page }) => {
  const dialog = await openTaskModal(page);
  const box = await dialog.boundingBox();
  if (!box) throw new Error("モーダルが見つかりません");

  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  await expect(page.locator("dialog[open]")).toHaveCount(1);
});

test("モーダルを開いている間は背景をスクロールさせない", async ({ page }) => {
  await openTaskModal(page);

  // useDialogController は position:fixed で背景を固定する。
  await expect(page.locator("body")).toHaveCSS("position", "fixed");

  await page.keyboard.press("Escape");

  await expect(page.locator("body")).not.toHaveCSS("position", "fixed");
});
