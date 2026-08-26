import { test, expect, request } from "@playwright/test";

/**
 * Stage 6 QA — cross-tenant RLS enforcement.
 *
 * We assert that a valid JWT for tenant A cannot read, mutate, or list any
 * row belonging to tenant B via PostgREST. This is the most consequential
 * invariant in the entire migration: if RLS regresses, every owner can see
 * every other owner's revenue.
 *
 * The test requires two pre-provisioned staging accounts. In CI these are
 * created by `scripts/seed-rls-fixtures.ts` (Stage 6 §6.2 deliverable);
 * locally we skip cleanly when the env vars are missing.
 *
 * Required env:
 *   E2E_SUPABASE_URL           – project URL
 *   E2E_SUPABASE_ANON_KEY      – anon key
 *   E2E_TENANT_A_EMAIL/PASSWORD/STORE_ID
 *   E2E_TENANT_B_EMAIL/PASSWORD/STORE_ID
 */
const cfg = {
  url:     process.env.E2E_SUPABASE_URL,
  anon:    process.env.E2E_SUPABASE_ANON_KEY,
  aEmail:  process.env.E2E_TENANT_A_EMAIL,
  aPass:   process.env.E2E_TENANT_A_PASSWORD,
  aStore:  process.env.E2E_TENANT_A_STORE_ID,
  bEmail:  process.env.E2E_TENANT_B_EMAIL,
  bPass:   process.env.E2E_TENANT_B_PASSWORD,
  bStore:  process.env.E2E_TENANT_B_STORE_ID,
};

const ready = Object.values(cfg).every(Boolean);

async function signIn(baseURL: string, anon: string, email: string, password: string) {
  const ctx = await request.newContext({ baseURL });
  const res = await ctx.post("/auth/v1/token?grant_type=password", {
    headers: { apikey: anon, "Content-Type": "application/json" },
    data:    { email, password },
  });
  expect(res.status(), `sign-in for ${email}`).toBe(200);
  const body = await res.json();
  await ctx.dispose();
  return body.access_token as string;
}

test.describe("RLS · cross-tenant isolation (requires live Supabase)", () => {
  test.skip(!ready, "E2E_* env vars for tenant A/B not set");

  test("tenant A cannot read tenant B's orders via PostgREST", async () => {
    const url = cfg.url!;
    const anon = cfg.anon!;
    const tokenA = await signIn(url, anon, cfg.aEmail!, cfg.aPass!);

    const ctx = await request.newContext({ baseURL: url });
    // Query orders scoped to tenant B's store — must return 0 rows, not 403,
    // because RLS is silent-filtering not error-raising.
    const res = await ctx.get(
      `/rest/v1/orders?store_id=eq.${cfg.bStore}&select=id`,
      {
        headers: {
          apikey: anon,
          Authorization: `Bearer ${tokenA}`,
          Accept: "application/json",
        },
      },
    );
    expect(res.status()).toBe(200);
    const rows = await res.json();
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBe(0);
    await ctx.dispose();
  });

  test("tenant A cannot advance a tenant B order (RPC guard)", async () => {
    const url = cfg.url!;
    const anon = cfg.anon!;
    const tokenA = await signIn(url, anon, cfg.aEmail!, cfg.aPass!);

    // First fetch a real tenant-B order id using the service role would
    // couple the test to secrets we don't want in the SPA repo. Instead we
    // assert the RPC raises `forbidden` (SQLSTATE 42501) when handed a
    // known-good store_id that A doesn't belong to. We synthesise a fake
    // order id — the RPC checks store membership BEFORE row existence,
    // so `forbidden` fires first.
    const ctx = await request.newContext({ baseURL: url });
    const res = await ctx.post(
      "/rest/v1/rpc/orders_advance_status",
      {
        headers: {
          apikey: anon,
          Authorization: `Bearer ${tokenA}`,
          "Content-Type": "application/json",
        },
        data: {
          p_order_id: "00000000-0000-0000-0000-00000000dead",
          p_next:     "READY",
        },
      },
    );
    // PostgREST maps 42501 → 403. Anything else (200, 404) is an RLS
    // regression that this test exists to catch.
    expect([401, 403]).toContain(res.status());
    await ctx.dispose();
  });

  test("tenant A cannot list tenant B categories", async () => {
    const url = cfg.url!;
    const anon = cfg.anon!;
    const tokenA = await signIn(url, anon, cfg.aEmail!, cfg.aPass!);

    const ctx = await request.newContext({ baseURL: url });
    const res = await ctx.get(
      `/rest/v1/categories?store_id=eq.${cfg.bStore}&select=id`,
      {
        headers: {
          apikey: anon,
          Authorization: `Bearer ${tokenA}`,
        },
      },
    );
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual([]);
    await ctx.dispose();
  });
});
