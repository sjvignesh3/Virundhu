/**
 * Public menu repo — anonymous read of a store's catalogue.
 *
 * Two fetch paths (chosen at runtime by env):
 *
 *   1. Edge-cached proxy  (default, prod + Vercel dev)
 *      GET <publicMenuBaseUrl>/:slug   →  /api/menu/:slug
 *      Served by `apps/spa/api/menu/[slug].ts` with
 *      `Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=86400`.
 *      99% of Chennai visitors hit the Vercel Edge in <50ms with zero DB load.
 *
 *   2. Direct Supabase view  (fallback)
 *      Used when `VITE_PUBLIC_MENU_BASE_URL=""`. Handy for local `vite dev`
 *      without a Vercel dev server, unit tests, and the Playwright suite.
 *
 * Contract is identical either way — { slug, store, categories }.
 */
import { getSupabase } from "../supabase";
import { getSupabaseEnv } from "../env";
import { ClientApiError, fromPostgrest } from "../errors";
import { API_ERROR_CODES } from "@virundhu/shared";
async function fetchViaEdgeProxy(baseUrl, slug) {
    const res = await fetch(`${baseUrl}/${encodeURIComponent(slug)}`, {
        method: "GET",
        headers: { accept: "application/json" },
    });
    if (res.status === 404) {
        throw new ClientApiError(API_ERROR_CODES.NOT_FOUND, "Menu not found", 404);
    }
    if (!res.ok) {
        throw new ClientApiError(API_ERROR_CODES.INTERNAL_ERROR, `Menu proxy responded ${res.status}`, res.status);
    }
    return (await res.json());
}
async function fetchViaSupabase(slug) {
    const { data, error } = await getSupabase()
        .from("public_store_menu")
        .select("slug, store, categories")
        .eq("slug", slug)
        .single();
    if (error)
        throw fromPostgrest(error);
    return data;
}
export const publicMenuRepo = {
    async bySlug(slug) {
        const { publicMenuBaseUrl } = getSupabaseEnv();
        if (publicMenuBaseUrl && publicMenuBaseUrl.length > 0) {
            return fetchViaEdgeProxy(publicMenuBaseUrl, slug);
        }
        return fetchViaSupabase(slug);
    },
    /**
     * Anonymous receipt lookup used by the success page. Backed by the
     * `public_order_lookup(slug, order_no)` RPC — the `orders` table itself
     * is denied to anon by RLS.
     */
    async lookupOrder(slug, orderNumber) {
        const { data, error } = await getSupabase().rpc("public_order_lookup", {
            p_slug: slug,
            p_order_number: orderNumber,
        });
        if (error)
            throw fromPostgrest(error);
        return data;
    },
};
