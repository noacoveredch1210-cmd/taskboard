import { test, expect } from "@playwright/test";
import { signIn } from "./fixtures/auth";
import { stubApi } from "./fixtures/api";

test("未ログインならログイン画面を出す", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("button", { name: /Google でログイン/ }),
  ).toBeVisible();
});

test("ログイン済みならボードのホーム画面を出す", async ({ page }) => {
  await signIn(page);
  await stubApi(page);

  await page.goto("/");

  await expect(page.getByText("ホーム画面")).toBeVisible();
  await expect(page.getByText("E2Eボード")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Google でログイン/ }),
  ).toHaveCount(0);
});
