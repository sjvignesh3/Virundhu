import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orderKeys, ordersRepo } from "@virundhu/client";
import type { OrderRow, OrderStatus } from "@virundhu/shared";
import { useActiveStoreId } from "@/lib/useActiveStoreId";
import { useOrdersRealtime } from "@/lib/useOrdersRealtime";
import { PageHeader } from "@/components/PageHeader";
import { formatCurrency, formatTime } from "@/lib/format";

export const Route = createFileRoute("/_auth/orders/live")({
  component: LiveOrdersPage,
});

const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
  NEW: "ACCEPTED",
  ACCEPTED: "PREPARING",
  PREPARING: "READY",
  READY: "COMPLETED",
  COMPLETED: null,
  CANCELLED: null,
};

const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  NEW: "Accept",
  ACCEPTED: "Start preparing",
  PREPARING: "Mark ready",
  READY: "Complete",
};

const COLUMNS: OrderStatus[] = ["NEW", "ACCEPTED", "PREPARING", "READY"];

function LiveOrdersPage() {
  const storeId = useActiveStoreId();
  if (!storeId) return <div className="p-6 text-sm text-neutral-500">Loading store…</div>;
  return <LiveInner storeId={storeId} />;
}

function LiveInner({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  useOrdersRealtime(storeId);

  const q = useQuery({
    queryKey: orderKeys.active(storeId),
    queryFn: () => ordersRepo.listActive(storeId),
    refetchInterval: 30_000, // safety net if realtime drops
  });

  const advance = useMutation({
    mutationFn: ({ orderId, next }: { orderId: string; next: OrderStatus }) =>
      ordersRepo.advanceStatus(orderId, next),
    onMutate: async ({ orderId, next }) => {
      await qc.cancelQueries({ queryKey: orderKeys.active(storeId) });
      const prev = qc.getQueryData<OrderRow[]>(orderKeys.active(storeId));
      qc.setQueryData<OrderRow[]>(orderKeys.active(storeId), (curr) =>
        (curr ?? []).map((o) => (o.id === orderId ? { ...o, status: next } : o)),
      );
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(orderKeys.active(storeId), ctx.prev);
      toast.error(err instanceof Error ? err.message : "Update failed");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: orderKeys.active(storeId) }),
  });

  const cancel = useMutation({
    mutationFn: (orderId: string) => ordersRepo.cancel(orderId, "owner_cancel"),
    onSuccess: () => {
      toast.success("Order cancelled");
      qc.invalidateQueries({ queryKey: orderKeys.active(storeId) });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Cancel failed"),
  });

  const grouped = groupByStatus(q.data ?? []);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        title="Live orders"
        subtitle={q.data ? `${q.data.length} active` : "Loading…"}
      />

      {q.error ? (
        <div className="card p-4 border-red-200 bg-red-50 text-red-700 text-sm">
          {(q.error as Error).message}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {COLUMNS.map((status) => (
          <div key={status} className="flex flex-col gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500 px-1">
              {status.toLowerCase()} · {grouped[status]?.length ?? 0}
            </div>
            {(grouped[status] ?? []).map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                onAdvance={() => {
                  const next = NEXT_STATUS[o.status];
                  if (next) advance.mutate({ orderId: o.id, next });
                }}
                onCancel={() => {
                  if (confirm(`Cancel order #${o.order_number}?`)) {
                    cancel.mutate(o.id);
                  }
                }}
              />
            ))}
            {(grouped[status]?.length ?? 0) === 0 ? (
              <div className="text-xs text-neutral-400 px-1 py-4">No orders</div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function OrderCard({
  order,
  onAdvance,
  onCancel,
}: {
  order: OrderRow;
  onAdvance: () => void;
  onCancel: () => void;
}) {
  const label = NEXT_LABEL[order.status];
  return (
    <div className="card p-3">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <div className="font-semibold">#{order.order_number}</div>
        <div className="text-xs text-neutral-500">{formatTime(order.created_at)}</div>
      </div>
      {order.customer_name ? (
        <div className="text-sm truncate">{order.customer_name}</div>
      ) : null}
      <div className="text-sm font-medium tabular-nums mt-1">
        {formatCurrency(order.total_amount)}
      </div>
      <div className="flex gap-1 mt-3">
        {label ? (
          <button className="btn btn-primary flex-1 text-xs" onClick={onAdvance}>
            {label}
          </button>
        ) : null}
        <button className="btn btn-outline text-xs" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function groupByStatus(orders: OrderRow[]): Partial<Record<OrderStatus, OrderRow[]>> {
  const g: Partial<Record<OrderStatus, OrderRow[]>> = {};
  for (const o of orders) {
    (g[o.status] ??= []).push(o);
  }
  return g;
}
