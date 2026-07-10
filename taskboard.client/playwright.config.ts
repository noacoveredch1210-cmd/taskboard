import { defineConfig, devices } from "@playwright/test";

const PORT = 5174;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "line" : "html",

  use: {
    baseURL,
    // 失敗したテストは、あとから操作を 1 ステップずつ再生できる。
    // 見るとき: npx playwright show-trace test-results/**/trace.zip
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  // 実 API・実 Supabase には繋がない（.env.e2e を参照する）。
  // API 応答は各テストが page.route で差し替える。
  webServer: {
    command: `npm run dev -- --mode e2e --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
