/**
 * Printers repo — CRUD + status tick. RLS scopes to caller's stores.
 */
import { getSupabase } from "../supabase";
import { fromPostgrest } from "../errors";
import { PRINTER_COLUMNS } from "../columns";
export const printersRepo = {
    async list(storeId) {
        const { data, error } = await getSupabase()
            .from("printers")
            .select(PRINTER_COLUMNS)
            .eq("store_id", storeId)
            .order("created_at");
        if (error)
            throw fromPostgrest(error);
        return (data ?? []);
    },
    async create(storeId, input) {
        const row = {
            ...input,
            store_id: storeId,
        };
        const { data, error } = await getSupabase()
            .from("printers")
            .insert(row)
            .select(PRINTER_COLUMNS)
            .single();
        if (error)
            throw fromPostgrest(error);
        return data;
    },
    async update(id, patch) {
        const { data, error } = await getSupabase()
            .from("printers")
            .update(patch)
            .eq("id", id)
            .select(PRINTER_COLUMNS)
            .single();
        if (error)
            throw fromPostgrest(error);
        return data;
    },
    async remove(id) {
        const { error } = await getSupabase().from("printers").delete().eq("id", id);
        if (error)
            throw fromPostgrest(error);
    },
};
