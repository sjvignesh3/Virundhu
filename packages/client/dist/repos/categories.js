/**
 * Categories repo — RLS scopes reads/writes to the caller's stores.
 */
import { getSupabase } from "../supabase";
import { fromPostgrest } from "../errors";
import { CATEGORY_COLUMNS } from "../columns";
export const categoriesRepo = {
    async list(storeId) {
        const { data, error } = await getSupabase()
            .from("categories")
            .select(CATEGORY_COLUMNS)
            .eq("store_id", storeId)
            .order("display_order", { ascending: true });
        if (error)
            throw fromPostgrest(error);
        return (data ?? []);
    },
    async get(id) {
        const { data, error } = await getSupabase()
            .from("categories")
            .select(CATEGORY_COLUMNS)
            .eq("id", id)
            .single();
        if (error)
            throw fromPostgrest(error);
        return data;
    },
    async create(storeId, input) {
        const row = {
            ...input,
            store_id: storeId,
        };
        const { data, error } = await getSupabase()
            .from("categories")
            .insert(row)
            .select(CATEGORY_COLUMNS)
            .single();
        if (error)
            throw fromPostgrest(error);
        return data;
    },
    async update(id, patch) {
        const { data, error } = await getSupabase()
            .from("categories")
            .update(patch)
            .eq("id", id)
            .select(CATEGORY_COLUMNS)
            .single();
        if (error)
            throw fromPostgrest(error);
        return data;
    },
    async remove(id) {
        const { error } = await getSupabase().from("categories").delete().eq("id", id);
        if (error)
            throw fromPostgrest(error);
    },
    async reorder(storeId, orderedIds) {
        const { error } = await getSupabase().rpc("categories_reorder", {
            p_store_id: storeId,
            p_ids: orderedIds,
        });
        if (error)
            throw fromPostgrest(error);
    },
};
