/**
 * Dashboard — single RPC returns the whole metrics blob so the panel does
 * one round-trip instead of N queries.
 */
import { getSupabase } from "../supabase";
import { fromPostgrest } from "../errors";

export interface DashboardSummary {
  range: string;
  revenue: number;
  orderCount: number;
  avgOrderValue: number;
  topProducts: Array<{
    product_id: string | null;
    name: string;
    qty: number;
    revenue: number;
  }>;
}

export const dashboardRepo = {
  async summary(storeId: string, range = "today"): Promise<DashboardSummary> {
    const { data, error } = await getSupabase().rpc("dashboard_summary", {
      p_store_id: storeId,
      p_range: range,
    });
    if (error) throw fromPostgrest(error);
    return data as unknown as DashboardSummary;
  },
};
