/**
 * Dashboard — single RPC returns the whole metrics blob so the panel does
 * one round-trip instead of N queries.
 */
import { getSupabase } from "../supabase";
import { fromPostgrest } from "../errors";
export const dashboardRepo = {
    async summary(storeId, range = "today") {
        const { data, error } = await getSupabase().rpc("dashboard_summary", {
            p_store_id: storeId,
            p_range: range,
        });
        if (error)
            throw fromPostgrest(error);
        return data;
    },
};
