import { test, expect } from "@playwright/test";

/**
 * Smoke check: unauthenticated visit routes to /login and renders the form.
 * Full auth e2e (signup → dashboard) runs against staging Supabase in CI.
 */
test("root redirects to login when signed out", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
});

test("login form shows a sign up link", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("link", { name: /create an account/i })).toBeVisible();
});
