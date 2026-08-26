/**
 * Products repo — RLS scopes reads/writes to the caller's stores.
 */
import { getSupabase } from "../supabase";
import { fromPostgrest } from "../errors";
import { PRODUCT_COLUMNS } from "../columns";
export const productsRepo = {
    async list(storeId, filter = {}) {
        let q = getSupabase()
            .from("products")
            .select(PRODUCT_COLUMNS)
            .eq("store_id", storeId);
        if (filter.categoryId)
            q = q.eq("category_id", filter.categoryId);
        if (filter.isAvailable !== undefined)
            q = q.eq("is_available", filter.isAvailable);
        if (filter.search)
            q = q.ilike("name", `%${filter.search}%`);
        q = q.order("display_order", { ascending: true }).order("name");
        const { data, error } = await q;
        if (error)
            throw fromPostgrest(error);
        return (data ?? []);
    },
    async get(id) {
        const { data, error } = await getSupabase()
            .from("products")
            .select(PRODUCT_COLUMNS)
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
            .from("products")
            .insert(row)
            .select(PRODUCT_COLUMNS)
            .single();
        if (error)
            throw fromPostgrest(error);
        return data;
    },
    async update(id, patch) {
        const { data, error } = await getSupabase()
            .from("products")
            .update(patch)
            .eq("id", id)
            .select(PRODUCT_COLUMNS)
            .single();
        if (error)
            throw fromPostgrest(error);
        return data;
    },
    async setAvailability(id, isAvailable) {
        return this.update(id, { is_available: isAvailable });
    },
    async remove(id) {
        const { error } = await getSupabase().from("products").delete().eq("id", id);
        if (error)
            throw fromPostgrest(error);
    },
    async reorder(storeId, orderedIds) {
        const { error } = await getSupabase().rpc("products_reorder", {
            p_store_id: storeId,
            p_ids: orderedIds,
        });
        if (error)
            throw fromPostgrest(error);
    },
};
