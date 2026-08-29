import { test, expect } from "@playwright/test";

/**
 * Stage 4 DoD: customer checkout → success page e2e.
 *
 * Exercises the full anonymous ordering flow against a live Supabase project
 * seeded with a demo store:
 *   1. open the public menu for a known slug,
 *   2. add an item to the cart,
 *   3. place the order,
 *   4. land on /order/:slug/success/:orderNumber,
 *   5. assert the receipt renders the order number, status and total.
 *
 * Requires staging Supabase (same gating as auth.spec.ts) plus a seeded,
 * OPEN store that is accepting orders. Provide via env:
 *   E2E_SUPABASE_URL       – Supabase project URL
 *   E2E_SUPABASE_ANON_KEY  – anon key
 *   E2E_MENU_SLUG          – slug of a seeded OPEN store (default: anna-street-food)
 *
 * Skipped locally so `npm run test:e2e` passes without a network dependency.
 */
const supabaseReady = Boolean(
  process.env.E2E_SUPABASE_URL && process.env.E2E_SUPABASE_ANON_KEY,
);
const slug = process.env.E2E_MENU_SLUG ?? "anna-street-food";

test.describe("public checkout → success (requires live Supabase)", () => {
  test.skip(!supabaseReady, "E2E_SUPABASE_* not set");

  test("customer can place an order and see the receipt", async ({ page }) => {
    // /menu/:slug must 301 to /order/:slug (legacy-QR canonical URL).
    await page.goto(`/menu/${slug}`);
    await expect(page).toHaveURL(new RegExp(`/order/${slug}$`), { timeout: 15_000 });

    // Menu loaded — the store heading is visible.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 15_000,
    });

    // Add the first available product to the cart.
    const addButton = page.getByRole("button", { name: /add$/i }).first();
    await expect(addButton).toBeVisible();
    await addButton.click();

    // Open the cart.
    await page.getByRole("button", { name: /view cart/i }).click();

    // Place the order (label includes the formatted total).
    const placeButton = page.getByRole("button", { name: /place order/i });
    await expect(placeButton).toBeEnabled();
    await placeButton.click();

    // Redirected to the success page.
    await expect(page).toHaveURL(
      new RegExp(`/order/${slug}/success/[^/]+$`),
      { timeout: 15_000 },
    );

    // Receipt confirmation renders.
    await expect(page.getByRole("heading", { name: /order placed/i })).toBeVisible();

    // Order number is echoed from the URL into the receipt card.
    const orderNumber = page.url().split("/").pop()!;
    await expect(page.getByText(orderNumber)).toBeVisible();

    // Receipt body resolves via public_order_lookup — items + total shown.
    await expect(page.getByText(/items/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/total to pay|total paid/i)).toBeVisible();

    // Order-more link returns to the store.
    await page.getByRole("link", { name: /order more/i }).click();
    await expect(page).toHaveURL(new RegExp(`/order/${slug}$`));
  });
});
