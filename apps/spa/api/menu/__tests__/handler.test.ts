/**
 * Unit test for the edge menu proxy. Verifies:
 *  - method guard (GET/HEAD only)
 *  - slug validation
 *  - SWR cache headers on 200
 *  - short negative cache on 404
 *  - 502 mapping for upstream failure
 *
 * We stub the global `fetch` because the handler runs in the Vercel edge
 * runtime at deploy time — this test does not need a real Supabase.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Handler imports must happen AFTER env is set so `process.env` reads take.
process.env.VITE_SUPABASE_URL = "https://example.supabase.co";
process.env.VITE_SUPABASE_ANON_KEY = "anon-test-key";

// eslint-disable-next-line @typescript-eslint/no-var-requires
import handler from "../[slug]";

const originalFetch = global.fetch;

function makeReq(pathname: string, method = "GET"): Request {
  return new Request(`http://localhost${pathname}`, { method });
}

describe("edge menu proxy", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("rejects non-GET/HEAD", async () => {
    const res = await handler(makeReq("/api/menu/anna", "POST"));
    expect(res.status).toBe(405);
  });

  it("rejects malformed slug", async () => {
    const res = await handler(makeReq("/api/menu/BAD_SLUG!"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("INVALID_SLUG");
  });

  it("returns menu with SWR headers on 200", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ slug: "anna", store: {}, categories: [] }), {
        status: 200,
      }),
    );
    const res = await handler(makeReq("/api/menu/anna-street-food"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe(
      "public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
    );
    expect(res.headers.get("cdn-cache-control")).toBe(
      "max-age=300, stale-while-revalidate=86400",
    );
    const body = await res.json();
    expect(body.slug).toBe("anna");
  });

  it("returns 404 with short negative-cache on missing store", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response("", { status: 406 }),
    );
    const res = await handler(makeReq("/api/menu/no-such"));
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toContain("max-age=30");
  });

  it("returns 502 when upstream fails", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response("", { status: 500 }),
    );
    const res = await handler(makeReq("/api/menu/anna"));
    expect(res.status).toBe(502);
  });
});
