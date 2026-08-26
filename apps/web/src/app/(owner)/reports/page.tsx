"use client";

import * as React from "react";
import {
  BarChart3,
  Download,
  IndianRupee,
  Loader2,
  ShoppingBag,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/owner/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useCollection } from "@/lib/repositories/repo-provider";
import { useDemoStore } from "@/lib/hooks/use-demo-store";
import { chosenBackend } from "@/lib/repositories";
import { fetchReportsSummary } from "@/lib/api/dashboard-api";
import type { Order } from "@/lib/domain/types";
import type { Repos } from "@/lib/repositories";
import { csvFilename, ordersToCsv } from "@/lib/domain/csv";
import { formatCurrency, cn } from "@/lib/utils";
import type { ReportsSummaryDTO } from "@virundhu/shared";

type Range = "today" | "7d" | "30d" | "all";
const RANGE_LABEL: Record<Range, string> = {
  today: "Today",
  "7d": "7 days",
  "30d": "30 days",
  all: "All time",
};

function sinceIso(r: Range): string | undefined {
  const d = new Date();
  switch (r) {
    case "today":
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
    case "7d":
      d.setDate(d.getDate() - 7);
      return d.toISOString();
    case "30d":
      d.setDate(d.getDate() - 30);
      return d.toISOString();
    case "all":
      return undefined;
  }
}

interface ComputedStats {
  revenue: number;
  orderCount: number;
  avgTicket: number;
  cancelRate: number;
  cancelled: number;
  topItems: { name: string; qty: number; revenue: number }[];
}

export default function ReportsPage() {
  const { store, loading: storeLoading } = useDemoStore();
  const [range, setRange] = React.useState<Range>("today");

  // ---------- API mode: server-computed summary ---------------------
  const summaryLoader = React.useCallback(
    async (_r: Repos) => {
      if (!store || chosenBackend() !== "api") return null;
      return fetchReportsSummary(store.id, { from: sinceIso(range) });
    },
    [store, range],
  );
  const { data: apiSummary, loading: summaryLoading } = useCollection(
    "orders",
    summaryLoader,
  );

  // ---------- Both modes: fetch orders for CSV export ---------------
  const ordersLoader = React.useCallback(
    async (r: Repos) => {
      if (!store) return [] as Order[];
      return r.orders.list(store.id, { from: sinceIso(range) });
    },
    [store, range],
  );
  const { data: orders, loading: ordersLoading } = useCollection("orders", ordersLoader);

  // ---------- Build computed stats ----------------------------------
  const stats = React.useMemo<ComputedStats>(() => {
    if (chosenBackend() === "api" && apiSummary) {
      const s = apiSummary as ReportsSummaryDTO;
      const topItemsFromOrders = (() => {
        const list = (orders ?? []).filter((o) => o.status === "COMPLETED");
        const map = new Map<string, { name: string; qty: number; revenue: number }>();
        for (const o of list) {
          for (const it of o.items) {
            const cur = map.get(it.productId ?? it.name) ?? { name: it.name, qty: 0, revenue: 0 };
            cur.qty += it.quantity;
            cur.revenue += it.lineTotal;
            map.set(it.productId ?? it.name, cur);
          }
        }
        return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 5);
      })();
      return {
        revenue: s.revenue,
        orderCount: s.completedCount,
        avgTicket: s.averageOrderValue,
        cancelRate: s.ordersCount > 0 ? Math.round((s.cancelledCount / s.ordersCount) * 100) : 0,
        cancelled: s.cancelledCount,
        topItems: topItemsFromOrders,
      };
    }

    // Local mode: compute from orders list.
    const list = orders ?? [];
    const completed = list.filter((o) => o.status === "COMPLETED");
    const cancelled = list.filter((o) => o.status === "CANCELLED");
    const revenue = completed.reduce((s, o) => s + o.total, 0);
    const orderCount = completed.length;
    const avgTicket = orderCount > 0 ? Math.round(revenue / orderCount) : 0;
    const cancelRate = list.length > 0 ? Math.round((cancelled.length / list.length) * 100) : 0;
    const itemMap = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const o of completed) {
      for (const it of o.items) {
        const cur = itemMap.get(it.productId) ?? { name: it.name, qty: 0, revenue: 0 };
        cur.qty += it.quantity;
        cur.revenue += it.lineTotal;
        itemMap.set(it.productId, cur);
      }
    }
    const topItems = Array.from(itemMap.values()).sort((a, b) => b.qty - a.qty).slice(0, 5);
    return { revenue, orderCount, avgTicket, cancelRate, topItems, cancelled: cancelled.length };
  }, [apiSummary, orders]);

  const loading = storeLoading || (summaryLoading && !apiSummary) || (ordersLoading && !orders);

  function handleExport() {
    const list = orders ?? [];
    if (list.length === 0) {
      toast.info("Nothing to export in this window.");
      return;
    }
    const csv = ordersToCsv(list);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = csvFilename("orders", range);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    toast.success(`Exported ${list.length} order${list.length === 1 ? "" : "s"}`);
  }

  if (storeLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Reports" description="Loading…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Revenue, orders, and best-sellers over your chosen window."
        actions={
          <div className="flex flex-wrap items-center gap-2">
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
            <Button
              size="sm"
              variant="outline"
              onClick={handleExport}
              disabled={!orders || orders.length === 0}
              title="Download filtered orders as CSV"
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading reports
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard
              icon={<IndianRupee className="h-4 w-4" />}
              label="Revenue"
              value={formatCurrency(stats.revenue)}
            />
            <StatCard
              icon={<ShoppingBag className="h-4 w-4" />}
              label="Completed Orders"
              value={String(stats.orderCount)}
            />
            <StatCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Avg Ticket"
              value={formatCurrency(stats.avgTicket)}
            />
            <StatCard
              icon={<XCircle className="h-4 w-4" />}
              label="Cancel Rate"
              value={`${stats.cancelRate}%`}
              sub={`${stats.cancelled} cancelled`}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Items</CardTitle>
              <CardDescription>Sorted by quantity sold in this window.</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.topItems.length === 0 ? (
                <EmptyState
                  icon={<BarChart3 className="h-6 w-6" />}
                  title="No sales yet"
                  description={`Place a test order to see reports for ${RANGE_LABEL[range].toLowerCase()}.`}
                />
              ) : (
                <ul className="space-y-3">
                  {stats.topItems.map((item, idx) => {
                    const max = stats.topItems[0].qty;
                    const pct = max > 0 ? (item.qty / max) * 100 : 0;
                    return (
                      <li key={item.name} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded bg-muted text-[10px] font-semibold text-muted-foreground">
                              {idx + 1}
                            </span>
                            <span className="font-medium">{item.name}</span>
                          </span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {item.qty} sold · {formatCurrency(item.revenue)}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="mt-3">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-xl font-bold sm:text-2xl tabular-nums">{value}</p>
          {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
