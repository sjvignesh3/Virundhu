import { test, expect } from "@playwright/test";

/**
 * Deferred Stage 2 DoD item: signup → dashboard → empty tenant read.
 *
 * Requires a live Supabase project reachable from CI (staging).
 * Provide via env:
 *   E2E_SUPABASE_URL      – Supabase project URL
 *   E2E_SUPABASE_ANON_KEY – anon key
 *
 * When these are absent the test is skipped so local `npm run test:e2e`
 * still passes without a network dependency.
 */
const supabaseReady = Boolean(
  process.env.E2E_SUPABASE_URL && process.env.E2E_SUPABASE_ANON_KEY,
);

test.describe("signup → owner console (requires live Supabase)", () => {
  test.skip(!supabaseReady, "E2E_SUPABASE_* not set");

  test("owner can sign up and lands on empty dashboard", async ({ page }) => {
    const stamp = Date.now();
    const email = `qa+${stamp}@virundhu.test`;

    await page.goto("/signup");
    await page.getByLabel(/store name/i).fill(`QA Store ${stamp}`);
    await page.getByLabel(/store slug/i).fill(`qa-${stamp}`);
    await page.getByLabel(/your name/i).fill("QA Owner");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/^password/i).fill("Test123!");
    await page.getByRole("button", { name: /create account/i }).click();

    // Backend provisioned tenant + session persisted → redirected to dashboard.
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

    // Empty tenant: welcome header renders and revenue is zero.
    await expect(page.getByText(/welcome back/i)).toBeVisible();
    await expect(page.getByText(/₹0/).first()).toBeVisible();
  });
});
