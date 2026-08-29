/**
 * Dashboard — single RPC returns the whole metrics blob so the panel does
 * one round-trip instead of N queries.
 *
 * v2 (migration 20260901002600): `orderCount` counts PLACED orders in the
 * range; `completedCount` / `cancelledCount` split the terminal states;
 * `activeCount` is the current kitchen queue (range-independent); `menu`
 * carries product-health stats for the dashboard MENU row.
 */
import { getSupabase } from "../supabase";
import { fromPostgrest } from "../errors";

export type DashboardRange = "today" | "7d" | "30d" | "all";

export interface DashboardMenuStats {
  totalProducts: number;
  available: number;
  unavailable: number;
  lowStock: number;
  outOfStock: number;
}

export interface DashboardSummary {
  range: string;
  /** Revenue from COMPLETED orders in the range (rupees). */
  revenue: number;
  /** Orders PLACED in the range, any status. */
  orderCount: number;
  completedCount: number;
  cancelledCount: number;
  /** Orders currently in the kitchen (NEW/ACCEPTED/PREPARING/READY). */
  activeCount: number;
  avgOrderValue: number;
  topProducts: Array<{
    product_id: string | null;
    name: string;
    qty: number;
    revenue: number;
  }>;
  menu: DashboardMenuStats;
}

export const dashboardRepo = {
  async summary(
    storeId: string,
    range: DashboardRange = "today",
  ): Promise<DashboardSummary> {
    const { data, error } = await getSupabase().rpc("dashboard_summary", {
      p_store_id: storeId,
      p_range: range,
    });
    if (error) throw fromPostgrest(error);
    return data as unknown as DashboardSummary;
  },
};
