"use client";

import * as React from "react";
import { History, Loader2, Search } from "lucide-react";
import { PageHeader } from "@/components/owner/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { OrderStatusBadge } from "@/features/orders/order-status-badge";
import { OrderDetailSheet } from "@/features/orders/order-detail-sheet";
import { useCollection } from "@/lib/repositories/repo-provider";
import { useDemoStore } from "@/lib/hooks/use-demo-store";
import type { Order } from "@/lib/domain/types";
import { formatCurrency, cn } from "@/lib/utils";

type Range = "today" | "7d" | "30d" | "all";

const RANGE_LABEL: Record<Range, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  all: "All time",
};

function rangeSince(r: Range): string | undefined {
  const now = new Date();
  switch (r) {
    case "today":
      now.setHours(0, 0, 0, 0);
      return now.toISOString();
    case "7d":
      now.setDate(now.getDate() - 7);
      return now.toISOString();
    case "30d":
      now.setDate(now.getDate() - 30);
      return now.toISOString();
    case "all":
      return undefined;
  }
}

export default function OrderHistoryPage() {
  const { store, loading: storeLoading } = useDemoStore();
  const [range, setRange] = React.useState<Range>("7d");
  const [search, setSearch] = React.useState("");

  const loader = React.useCallback(
    async (repos: import("@/lib/repositories").Repos) => {
      if (!store) return [] as Order[];
      return repos.orders.list(store.id, {
        status: ["COMPLETED", "CANCELLED"],
        from: rangeSince(range),
      });
    },
    [store, range],
  );

  const { data: orders, loading } = useCollection("orders", loader);

  const filtered = React.useMemo(() => {
    if (!orders) return [];
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        (o.customer.name?.toLowerCase().includes(q) ?? false) ||
        (o.customer.phone?.toLowerCase().includes(q) ?? false),
    );
  }, [orders, search]);

  const [selected, setSelected] = React.useState<Order | null>(null);
  const [open, setOpen] = React.useState(false);

  const totalRevenue = React.useMemo(
    () => filtered.filter((o) => o.status === "COMPLETED").reduce((s, o) => s + o.total, 0),
    [filtered],
  );

  if (storeLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Order History" description="Loading…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Order History"
        description="Completed and cancelled orders."
        actions={
          <>
            <Badge variant="info">{filtered.length} orders</Badge>
            <Badge variant="success">{formatCurrency(totalRevenue)} revenue</Badge>
          </>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order #, name, or phone"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1 rounded-md border bg-muted/30 p-1">
          {(Object.keys(RANGE_LABEL) as Range[]).map((r) => (
            <Button
              key={r}
              size="sm"
              variant={range === r ? "default" : "ghost"}
              onClick={() => setRange(r)}
              className={cn("h-7 text-xs", range === r && "shadow-sm")}
            >
              {RANGE_LABEL[r]}
            </Button>
          ))}
        </div>
      </div>

      {loading && !orders ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading history
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<History className="h-6 w-6" />}
          title="No orders found"
          description={
            search
              ? "Try a different search."
              : `No completed or cancelled orders ${RANGE_LABEL[range].toLowerCase()}.`
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            {/* Desktop table */}
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30">
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Order #</th>
                    <th className="px-4 py-2 font-medium">Customer</th>
                    <th className="px-4 py-2 font-medium">Items</th>
                    <th className="px-4 py-2 font-medium">Total</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o) => (
                    <tr
                      key={o.id}
                      onClick={() => {
                        setSelected(o);
                        setOpen(true);
                      }}
                      className="cursor-pointer border-b transition-colors last:border-b-0 hover:bg-muted/40"
                    >
                      <td className="px-4 py-3 font-semibold tabular-nums">
                        #{o.orderNumber}
                      </td>
                      <td className="px-4 py-3">
                        {o.customer.name ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                        {o.customer.phone && (
                          <p className="text-xs text-muted-foreground">
                            {o.customer.phone}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {o.items.reduce((s, i) => s + i.quantity, 0)}
                      </td>
                      <td className="px-4 py-3 font-semibold tabular-nums">
                        {formatCurrency(o.total)}
                      </td>
                      <td className="px-4 py-3">
                        <OrderStatusBadge status={o.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(o.completedAt ?? o.updatedAt).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile list */}
            <ul className="divide-y md:hidden">
              {filtered.map((o) => (
                <li
                  key={o.id}
                  onClick={() => {
                    setSelected(o);
                    setOpen(true);
                  }}
                  className="flex cursor-pointer items-start gap-3 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold tabular-nums">
                        #{o.orderNumber}
                      </span>
                      <OrderStatusBadge status={o.status} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {o.customer.name ?? "Guest"} ·{" "}
                      {o.items.reduce((s, i) => s + i.quantity, 0)} items
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(o.completedAt ?? o.updatedAt).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatCurrency(o.total)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <OrderDetailSheet order={selected} open={open} onOpenChange={setOpen} />
    </div>
  );
}
