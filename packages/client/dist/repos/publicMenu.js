/**
 * Public menu — anonymous read via `public_store_menu` view. Used by the
 * customer-facing `/order/:slug` page. Stage 4 fronts this with a CDN edge
 * cache; the repo call itself stays identical.
 *
 * The view exposes three columns:
 *   - slug        text       (filterable so PostgREST can use the index)
 *   - store       jsonb      (camelCase store payload incl. settings)
 *   - categories  jsonb      (nested categories[].products[])
 */
import { getSupabase } from "../supabase";
import { fromPostgrest } from "../errors";
export const publicMenuRepo = {
    async bySlug(slug) {
        const { data, error } = await getSupabase()
            .from("public_store_menu")
            .select("slug, store, categories")
            .eq("slug", slug)
            .single();
        if (error)
            throw fromPostgrest(error);
        return data;
    },
};
