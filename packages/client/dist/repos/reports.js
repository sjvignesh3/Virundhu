/**
 * Reports repo — set-returning RPC feeds the CSV export page directly.
 */
import { getSupabase } from "../supabase";
import { fromPostgrest } from "../errors";
export const reportsRepo = {
    async sales(storeId, from, to) {
        const { data, error } = await getSupabase().rpc("reports_sales_rows", {
            p_store_id: storeId,
            p_from: from,
            p_to: to,
        });
        if (error)
            throw fromPostgrest(error);
        return (data ?? []);
    },
};
