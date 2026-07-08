/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import plugin from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [plugin()],
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
    // 実際の認証情報に依存せずモジュールを読み込めるようダミー値を注入する
    // （lib/supabase.ts は未設定だと throw するため）
    env: {
      VITE_SUPABASE_URL: "http://localhost:54321",
      VITE_SUPABASE_ANON_KEY: "test-anon-key",
      VITE_API_BASE_URL: "http://localhost:5000/api",
    },
  },
});
