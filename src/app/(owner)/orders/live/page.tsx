"use client";

import * as React from "react";
import { ClipboardList, Loader2, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/owner/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { OrderStatusBadge } from "@/features/orders/order-status-badge";
import { OrderDetailSheet } from "@/features/orders/order-detail-sheet";
import { formatElapsed, useTicker } from "@/features/orders/elapsed";
import { useCollection } from "@/lib/repositories/repo-provider";
import { useDemoStore } from "@/lib/hooks/use-demo-store";
import { ACTIVE_STATUS_FLOW } from "@/lib/domain/order-status";
import type { Order, OrderStatus } from "@/lib/domain/types";
import { formatCurrency, cn } from "@/lib/utils";

const COLUMN_LABELS: Record<OrderStatus, string> = {
  NEW: "New",
  ACCEPTED: "Accepted",
  PREPARING: "Preparing",
  READY: "Ready",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export default function LiveOrdersPage() {
  useTicker(30_000); // live "N minutes ago"
  const { store, loading: storeLoading } = useDemoStore();

  const loader = React.useCallback(
    async (repos: import("@/lib/repositories").Repos) => {
      if (!store) return [] as Order[];
      return repos.orders.list(store.id, { status: [...ACTIVE_STATUS_FLOW] });
    },
    [store],
  );
  const { data: orders, loading, refresh } = useCollection("orders", loader);

  const [selected, setSelected] = React.useState<Order | null>(null);
  const [open, setOpen] = React.useState(false);

  const grouped = React.useMemo(() => {
    const map: Record<OrderStatus, Order[]> = {
      NEW: [],
      ACCEPTED: [],
      PREPARING: [],
      READY: [],
      COMPLETED: [],
      CANCELLED: [],
    };
    for (const o of orders ?? []) {
      map[o.status].push(o);
    }
    return map;
  }, [orders]);

  const total = (orders ?? []).length;

  if (storeLoading || (loading && !orders)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Live Orders" description="Loading…" />
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading orders
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Orders"
        description="Tap a card to advance status or cancel."
        actions={
          <>
            <Badge variant="info">{total} in queue</Badge>
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
          </>
        }
      />

      {total === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-6 w-6" />}
          title="No live orders"
          description="Orders placed by customers will appear here in real time."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {ACTIVE_STATUS_FLOW.map((status) => (
            <Column
              key={status}
              status={status}
              label={COLUMN_LABELS[status]}
              orders={grouped[status]}
              onSelect={(o) => {
                setSelected(o);
                setOpen(true);
              }}
            />
          ))}
        </div>
      )}

      <OrderDetailSheet
        order={selected}
        open={open}
        onOpenChange={setOpen}
        onTransitioned={(o) => setSelected(o)}
      />
    </div>
  );
}

function Column({
  status,
  label,
  orders,
  onSelect,
}: {
  status: OrderStatus;
  label: string;
  orders: Order[];
  onSelect: (o: Order) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{label}</h3>
          <OrderStatusBadge status={status} className="text-[9px]" />
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">{orders.length}</span>
      </div>

      <div className="flex flex-col gap-2 rounded-lg bg-muted/40 p-2 min-h-[6rem]">
        {orders.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">Empty</p>
        )}
        {orders.map((o) => (
          <OrderCard key={o.id} order={o} onClick={() => onSelect(o)} />
        ))}
      </div>
    </div>
  );
}

function OrderCard({ order, onClick }: { order: Order; onClick: () => void }) {
  const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);
  return (
    <Card
      onClick={onClick}
      className={cn(
        "cursor-pointer transition-all hover:shadow-md active:scale-[0.99]",
        order.status === "NEW" && "border-info/40",
      )}
    >
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold tabular-nums">#{order.orderNumber}</span>
          <span className="text-xs text-muted-foreground">{formatElapsed(order.createdAt)}</span>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {order.items
            .slice(0, 3)
            .map((i) => `${i.quantity}× ${i.name}`)
            .join(", ")}
          {order.items.length > 3 && ` +${order.items.length - 3} more`}
        </p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            {itemCount} item{itemCount === 1 ? "" : "s"}
            {order.customer.name && ` · ${order.customer.name}`}
          </span>
          <span className="text-sm font-semibold tabular-nums">
            {formatCurrency(order.total)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
