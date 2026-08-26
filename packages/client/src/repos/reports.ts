/**
 * Reports repo — set-returning RPC feeds the CSV export page directly.
 */
import { getSupabase } from "../supabase";
import { fromPostgrest } from "../errors";
import type { OrderStatus } from "@virundhu/shared";

export interface SalesReportRow {
  order_number: string;
  created_at: string;
  status: OrderStatus;
  customer_name: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  items: number;
}

export const reportsRepo = {
  async sales(
    storeId: string,
    from: string,
    to: string,
  ): Promise<SalesReportRow[]> {
    const { data, error } = await getSupabase().rpc("reports_sales_rows", {
      p_store_id: storeId,
      p_from: from,
      p_to: to,
    });
    if (error) throw fromPostgrest(error);
    return (data ?? []) as unknown as SalesReportRow[];
  },
};
