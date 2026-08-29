import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabase, orderKeys, dashboardKeys } from "@virundhu/client";

/**
 * Subscribe to realtime INSERT/UPDATE events on `orders` scoped to a single
 * store, invalidating the active-orders, list AND dashboard caches on any
 * change — the dashboard reads order-derived numbers, so it must refresh on
 * the same signal (it previously waited for its 30s staleTime, which is why
 * it felt slow).
 *
 * Cost-optimized:
 *  - one channel per mounted route (unsubscribed on unmount). Mounted by the
 *    Live Orders board AND the Dashboard — TanStack Router renders one route
 *    at a time, so an owner tab still holds at most ONE channel.
 *  - server-side filter (`store_id=eq.<id>`) so RLS + realtime narrow rows early.
 *  - invalidates by prefix — TanStack fans out automatically.
 */
export function useOrdersRealtime(storeId: string | null) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!storeId) return;
    const supabase = getSupabase();

    const invalidate = () => {
      qc.invalidateQueries({ queryKey: orderKeys.active(storeId) });
      qc.invalidateQueries({ queryKey: [...orderKeys.all, "list", storeId] });
      qc.invalidateQueries({ queryKey: dashboardKeys.all });
    };

    const channel = supabase
      .channel(`orders:${storeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `store_id=eq.${storeId}`,
        },
        invalidate,
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `store_id=eq.${storeId}`,
        },
        invalidate,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId, qc]);
}
