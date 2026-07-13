/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import plugin from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    plugin(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico"],
      useCredentials: true,
      manifest: {
        name: "タスクボード",
        short_name: "タスクボード",
        description: "タスク管理ができる PWA",
        lang: "ja",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#efefef",
        theme_color: "#4F7C7E",
        icons: [
          // 透過PNG（角丸背景なし／あり両方OK）
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },

          // Android で綺麗に切り抜く maskable
          {
            src: "/pwa-192x192-maskable.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/pwa-512x512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      // オフライン/更新戦略（後述）
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        // ログアウト時のリダイレクトを阻害しないよう設定
        navigateFallback: null,
        globIgnores: ["**/index.html"],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: parseInt(process.env.DEV_SERVER_PORT || "5173"),
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true,
    // e2e/ は Playwright が実行する（vitest が拾うと import で落ちる）。
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
    // 実際の認証情報に依存せずモジュールを読み込めるようダミー値を注入する
    // （lib/supabase.ts は未設定だと throw するため）
    env: {
      VITE_SUPABASE_URL: "http://localhost:54321",
      VITE_SUPABASE_ANON_KEY: "test-anon-key",
      VITE_API_BASE_URL: "http://localhost:5000/api",
    },
    coverage: {
      provider: "v8",
      // include を指定しないと、テストから import されたファイルしか集計されない。
      // それだと「一度もテストしていないファイル」が分母から消え、数字が実態より高く出る。
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/test/**",
        "src/vite-env.d.ts",
        // 実行時コードを持たない型定義のみのファイル
        "src/types/**",
        "src/api/types.ts",
        // 再エクスポートのみ
        "src/api/index.ts",
        // アプリのブートストラップ（DOM への mount のみ）
        "src/main.tsx",
      ],
    },
  },
});
