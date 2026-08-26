import { defineConfig, devices } from "@playwright/test";

/**
 * Runs against a local preview build. Set VIRUNDHU_SPA_URL to hit staging.
 * CI runs `pnpm build && pnpm preview` before invoking playwright.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.VIRUNDHU_SPA_URL ?? "http://localhost:4173",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: process.env.VIRUNDHU_SPA_URL
    ? undefined
    : {
        command: "npm run preview",
        port: 4173,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
