/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@virundhu/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
      "@virundhu/client": path.resolve(__dirname, "../../packages/client/src/index.ts"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    // Playwright specs live under ./e2e/ and are executed by `npm run test:e2e`.
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
  },
});
