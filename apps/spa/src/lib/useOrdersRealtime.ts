import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabase, orderKeys } from "@virundhu/client";

/**
 * Subscribe to realtime INSERT/UPDATE events on `orders` scoped to a single
 * store, invalidating any active-orders + list caches on any change.
 *
 * Cost-optimized:
 *  - one channel per mounted route (unsubscribed on unmount).
 *  - server-side filter (`store_id=eq.<id>`) so RLS + realtime narrow rows early.
 *  - invalidates by prefix (["orders"]) — TanStack fans out automatically.
 */
export function useOrdersRealtime(storeId: string | null) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!storeId) return;
    const supabase = getSupabase();

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
        () => {
          qc.invalidateQueries({ queryKey: orderKeys.active(storeId) });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `store_id=eq.${storeId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: orderKeys.active(storeId) });
          qc.invalidateQueries({ queryKey: [...orderKeys.all, "list", storeId] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId, qc]);
}
