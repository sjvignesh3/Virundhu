import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { orderKeys, ordersRepo } from "@virundhu/client";
import type { LiveOrderRow } from "@virundhu/client";
import type { OrderStatus } from "@virundhu/shared";
import { useActiveStoreId } from "@/lib/useActiveStoreId";
import { useOrdersRealtime } from "@/lib/useOrdersRealtime";
import { PageHeader } from "@/components/PageHeader";
import { NoStoreState } from "@/components/NoStoreState";
import { formatCurrency, formatAgo } from "@/lib/format";
import { cn } from "@/lib/cn";

export const Route = createFileRoute("/_auth/orders/live")({
  component: LiveOrdersPage,
});

// Stage 9: the ACCEPTED column is gone — one tap sends a NEW order straight
// to PREPARING (state machine allows NEW → PREPARING since migration
// 20260901002700). Legacy ACCEPTED rows render in the Preparing column with
// their own valid next step.
const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
  NEW: "PREPARING",
  ACCEPTED: "PREPARING",
  PREPARING: "READY",
  READY: "COMPLETED",
  COMPLETED: null,
  CANCELLED: null,
};

const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  NEW: "Start preparing",
  ACCEPTED: "Start preparing",
  PREPARING: "Mark ready",
  READY: "Complete",
};

const COLUMNS: { statuses: OrderStatus[]; label: string; pill: string; pillText: string }[] = [
  { statuses: ["NEW"], label: "New", pill: "bg-brand-soft text-brand", pillText: "NEW" },
  {
    statuses: ["PREPARING", "ACCEPTED"],
    label: "Preparing",
    pill: "bg-amber-100 text-amber-800",
    pillText: "PREPARING",
  },
  { statuses: ["READY"], label: "Ready", pill: "bg-green-100 text-green-700", pillText: "READY" },
];

function LiveOrdersPage() {
  const storeId = useActiveStoreId();
  if (!storeId) return <NoStoreState />;
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

  function patchLocal(orderId: string, next: OrderStatus) {
    qc.setQueryData<LiveOrderRow[]>(orderKeys.active(storeId), (curr) =>
      (curr ?? [])
        .map((o) => (o.id === orderId ? { ...o, status: next } : o))
        // COMPLETED / CANCELLED leave the board immediately.
        .filter((o) => o.status !== "COMPLETED" && o.status !== "CANCELLED"),
    );
  }

  const advance = useMutation({
    mutationFn: ({ orderId, next }: { orderId: string; next: OrderStatus }) =>
      ordersRepo.advanceStatus(orderId, next),
    onMutate: async ({ orderId, next }) => {
      await qc.cancelQueries({ queryKey: orderKeys.active(storeId) });
      const prev = qc.getQueryData<LiveOrderRow[]>(orderKeys.active(storeId));
      patchLocal(orderId, next);
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(orderKeys.active(storeId), ctx.prev);
      toast.error(err instanceof Error ? err.message : "Update failed");
    },
    onSuccess: (_d, { next }) => toast.success(`Marked as ${next}`),
    onSettled: () => qc.invalidateQueries({ queryKey: orderKeys.active(storeId) }),
  });

  const cancel = useMutation({
    mutationFn: (orderId: string) => ordersRepo.cancel(orderId),
    onMutate: async (orderId) => {
      await qc.cancelQueries({ queryKey: orderKeys.active(storeId) });
      const prev = qc.getQueryData<LiveOrderRow[]>(orderKeys.active(storeId));
      qc.setQueryData<LiveOrderRow[]>(orderKeys.active(storeId), (curr) =>
        (curr ?? []).filter((o) => o.id !== orderId),
      );
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(orderKeys.active(storeId), ctx.prev);
      toast.error(err instanceof Error ? err.message : "Cancel failed");
    },
    onSuccess: () => toast.success("Order cancelled"),
    onSettled: () => qc.invalidateQueries({ queryKey: orderKeys.active(storeId) }),
  });

  const [confirmCancel, setConfirmCancel] = useState<LiveOrderRow | null>(null);
  const rows = q.data ?? [];

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl">
      <PageHeader
        title="Live Orders"
        subtitle="Tap a card to advance status or cancel."
        actions={
          <>
            <span className="badge bg-brand-soft text-brand !py-1.5 !px-3">
              {rows.length} in queue
            </span>
            <button
              className="btn btn-outline"
              onClick={() => qc.invalidateQueries({ queryKey: orderKeys.active(storeId) })}
            >
              ⟳ Refresh
            </button>
          </>
        }
      />

      {q.isLoading ? (
        <div className="text-sm text-neutral-500">Loading…</div>
      ) : q.error ? (
        <div className="card p-4 border-red-200 bg-red-50 text-red-700 text-sm">
          {(q.error as Error).message}
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-4">
          {COLUMNS.map((col) => {
            const colOrders = rows.filter((o) => col.statuses.includes(o.status));
            return (
              <section key={col.label}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-bold">{col.label}</span>
                  <span className={cn("badge", col.pill)}>{col.pillText}</span>
                  <span className="ml-auto text-sm text-neutral-500 tabular-nums">
                    {colOrders.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {colOrders.length === 0 ? (
                    <div className="card !bg-neutral-100 border-dashed p-6 text-center text-sm text-neutral-400">
                      Empty
                    </div>
                  ) : (
                    colOrders.map((o) => (
                      <OrderCard
                        key={o.id}
                        order={o}
                        pending={advance.isPending || cancel.isPending}
                        onAdvance={() => {
                          const next = NEXT_STATUS[o.status];
                          if (next) advance.mutate({ orderId: o.id, next });
                        }}
                        onCancel={() => setConfirmCancel(o)}
                      />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {confirmCancel ? (
        <div className="fixed inset-0 bg-black/60 grid place-items-center p-4 z-50">
          <div className="card w-full max-w-sm p-6">
            <h2 className="font-bold text-lg">Cancel order #{confirmCancel.order_number}?</h2>
            <p className="text-sm text-neutral-500 mt-2">
              The customer will see the order as cancelled. This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end mt-5">
              <button className="btn btn-outline" onClick={() => setConfirmCancel(null)}>
                Keep order
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  cancel.mutate(confirmCancel.id);
                  setConfirmCancel(null);
                }}
              >
                Cancel order
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function OrderCard({
  order,
  pending,
  onAdvance,
  onCancel,
}: {
  order: LiveOrderRow;
  pending: boolean;
  onAdvance: () => void;
  onCancel: () => void;
}) {
  const nextLabel = NEXT_LABEL[order.status];
  const itemsLine = order.items
    ?.map((i) => `${i.quantity}× ${i.product_name}`)
    .join(", ");
  const itemCount = order.items?.reduce((s, i) => s + i.quantity, 0) ?? 0;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-extrabold tabular-nums">#{order.order_number}</span>
        <span className="text-xs text-neutral-400">{formatAgo(order.created_at)}</span>
      </div>
      {itemsLine ? (
        <div className="text-sm text-neutral-600 mt-1.5 line-clamp-2">{itemsLine}</div>
      ) : null}
      <div className="flex items-center justify-between mt-2 text-sm">
        <span className="text-neutral-500">
          {itemCount} item{itemCount === 1 ? "" : "s"}
          {order.customer_name ? ` · ${order.customer_name}` : ""}
        </span>
        <span className="font-extrabold tabular-nums">{formatCurrency(order.total_amount)}</span>
      </div>
      <div className="flex gap-2 mt-3">
        {nextLabel ? (
          <button className="btn btn-primary flex-1" disabled={pending} onClick={onAdvance}>
            {nextLabel}
          </button>
        ) : null}
        <button className="btn btn-outline" disabled={pending} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
