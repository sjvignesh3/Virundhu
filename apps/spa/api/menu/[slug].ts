/**
 * Public menu edge proxy.
 *
 * Path: GET /api/menu/:slug
 *
 * Why this route exists (Plan §4.1):
 *   Fronting the Supabase `public_store_menu` view with a Vercel Edge cache
 *   collapses ~1 000 daily customer visits per store down to at most one
 *   database round-trip every 5 minutes. That is a ~3.5× reduction in DB
 *   egress at 300 stores.
 *
 * Caching policy:
 *   - `max-age=60`         — browser cache: repeat visits within a minute are
 *                            served from disk, zero network hop.
 *   - `s-maxage=300`       — Vercel Edge cache: 5-minute freshness at PoP.
 *   - `stale-while-revalidate=86400`
 *                          — up to 24 h of stale-serve while the edge
 *                            revalidates in the background. Owner menu edits
 *                            are visible to customers within 5 min without
 *                            any explicit purge — well inside the acceptable
 *                            UX window for menu updates.
 *   - `CDN-Cache-Control`  — explicit override so the browser policy above
 *                            never leaks into the shared CDN key.
 *
 * We deliberately do NOT expose a revalidation endpoint. Natural TTL keeps
 * this route stateless, secret-free, and cheap; the trade-off (up-to-5-min
 * staleness) is documented in the runbook.
 */

export const config = { runtime: "edge" };

type MenuRow = { store: unknown; categories: unknown };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_ANON = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405 });
  }
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return new Response(
      JSON.stringify({ error: "MISCONFIGURED" }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const slug = parts[parts.length - 1];
  if (!slug || !/^[a-z0-9-]{2,64}$/.test(slug)) {
    return new Response(
      JSON.stringify({ error: "INVALID_SLUG" }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const upstream = await fetch(
    `${SUPABASE_URL}/rest/v1/public_store_menu?slug=eq.${encodeURIComponent(slug)}&select=slug,store,categories`,
    {
      headers: {
        apikey: SUPABASE_ANON,
        authorization: `Bearer ${SUPABASE_ANON}`,
        accept: "application/vnd.pgrst.object+json",
      },
    },
  );

  if (upstream.status === 406 /* no rows */ || upstream.status === 404) {
    return new Response(
      JSON.stringify({ error: "STORE_NOT_FOUND" }),
      {
        status: 404,
        headers: {
          "content-type": "application/json",
          // Negative cache short — a newly opened store shows up in ≤30s.
          "cache-control": "public, max-age=30, s-maxage=30",
        },
      },
    );
  }
  if (!upstream.ok) {
    return new Response(
      JSON.stringify({ error: "UPSTREAM", status: upstream.status }),
      { status: 502, headers: { "content-type": "application/json" } },
    );
  }

  const body = (await upstream.json()) as MenuRow;
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
      "cdn-cache-control": "max-age=300, stale-while-revalidate=86400",
      "vary": "accept-encoding",
      // Diagnostic — visible in browser devtools to confirm which edge served.
      "x-served-by": "spa-edge/menu",
    },
  });
}
