"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BarChart3,
  ClipboardList,
  IndianRupee,
  Loader2,
  Package,
  Plus,
  QrCode,
  ShoppingBag,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/owner/page-header";
import { OrderStatusBadge } from "@/features/orders/order-status-badge";
import { formatElapsed, useTicker } from "@/features/orders/elapsed";
import { useCollection, useRepos } from "@/lib/repositories/repo-provider";
import { useDemoStore } from "@/lib/hooks/use-demo-store";
import { chosenBackend } from "@/lib/repositories";
import { fetchDashboardMetrics } from "@/lib/api/dashboard-api";
import {
  computeProductMetrics,
  computeTodayMetrics,
  computeTopItems,
} from "@/lib/domain/dashboard-metrics";
import { ACTIVE_STATUS_FLOW } from "@/lib/domain/order-status";
import { formatCurrency } from "@/lib/utils";
import type { DashboardMetricsDTO } from "@cartsas/shared";
import type { Order, Product } from "@/lib/domain/types";
import type { Repos } from "@/lib/repositories";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MetricSnapshot {
  ordersToday: number;
  completedToday: number;
  activeOrders: number;
  revenueToday: number;
  totalProducts: number;
  availableProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
  categoryCount: number;
  topItems: { productId: string | null; name: string; quantity: number }[];
  liveOrders: Order[];
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  useTicker(30_000);
  const repos = useRepos();
  const { store, loading: storeLoading } = useDemoStore();

  // ---------- API mode: fetch pre-computed metrics from the backend ----------
  const apiMetricsLoader = React.useCallback(
    async (_r: Repos) => {
      if (!store || chosenBackend() !== "api") return null;
      return fetchDashboardMetrics(store.id);
    },
    [store],
  );
  const { data: apiMetrics, loading: apiMetricsLoading } = useCollection(
    "orders", // re-uses the same collection key so live-board refreshes trigger this too
    apiMetricsLoader,
    { poll: true, pollMs: 10_000 },
  );

  // ---------- Active orders for the live-preview strip (both modes) ---------
  const activeLoader = React.useCallback(
    async (r: Repos) => {
      if (!store) return [] as Order[];
      return r.orders.list(store.id, { status: [...ACTIVE_STATUS_FLOW] });
    },
    [store],
  );
  const { data: activeOrders, loading: activeLoading } = useCollection(
    "orders",
    activeLoader,
    { poll: chosenBackend() === "api", pollMs: 5_000 },
  );

  // ---------- Local mode: compute metrics from raw collections --------------
  const ordersLoader = React.useCallback(
    async (r: Repos) =>
      chosenBackend() === "local" && store ? r.orders.list(store.id) : ([] as Order[]),
    [store],
  );
  const productsLoader = React.useCallback(
    async (r: Repos) =>
      chosenBackend() === "local" && store ? r.products.list(store.id) : ([] as Product[]),
    [store],
  );
  const { data: allOrders } = useCollection("orders", ordersLoader);
  const { data: allProducts } = useCollection("products", productsLoader);

  // ---------- Build metric snapshot -----------------------------------------
  const metrics = React.useMemo<MetricSnapshot | null>(() => {
    const live = (activeOrders ?? []).filter((o) =>
      (ACTIVE_STATUS_FLOW as readonly string[]).includes(o.status),
    );

    if (chosenBackend() === "api" && apiMetrics) {
      const dto = apiMetrics as DashboardMetricsDTO;
      return {
        ordersToday: dto.ordersToday,
        completedToday: dto.completedToday,
        activeOrders: dto.activeOrders,
        revenueToday: dto.revenueToday,
        totalProducts: dto.totalProducts,
        availableProducts: dto.availableProducts,
        lowStockCount: dto.lowStockCount,
        outOfStockCount: dto.outOfStockCount,
        categoryCount: dto.categoryCount,
        topItems: dto.topItems,
        liveOrders: live.slice(0, 5),
      };
    }

    // Local mode fallback — compute from raw arrays.
    if (chosenBackend() === "local") {
      const today = computeTodayMetrics(allOrders ?? []);
      const productStats = computeProductMetrics(allProducts ?? []);
      const topItems = computeTopItems(allOrders ?? [], 5);
      return {
        ordersToday: today.ordersToday,
        completedToday: today.completedToday,
        activeOrders: today.activeOrders,
        revenueToday: today.revenueToday,
        totalProducts: productStats.total,
        availableProducts: productStats.available,
        lowStockCount: productStats.lowStock,
        outOfStockCount: productStats.outOfStock,
        categoryCount: 0,
        topItems: topItems.map((i) => ({ productId: i.productId, name: i.name, quantity: i.quantity })),
        liveOrders: live.slice(0, 5),
      };
    }

    return null;
  }, [apiMetrics, activeOrders, allOrders, allProducts]);

  const bootLoading =
    !repos ||
    storeLoading ||
    (chosenBackend() === "api" ? apiMetricsLoading && !apiMetrics : activeLoading && !activeOrders);

  if (bootLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Loading…" />
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading dashboard
        </div>
      </div>
    );
  }

  const m = metrics;
  const greetingName = store?.name ?? "there";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${greetingName} 👋`}
        description="Here's what's happening at your cart today."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/qr">
                <QrCode className="mr-2 h-4 w-4" />
                View QR
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/orders/live">
                <ClipboardList className="mr-2 h-4 w-4" />
                Live Orders
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/products">
                <Plus className="mr-2 h-4 w-4" />
                Add Product
              </Link>
            </Button>
          </>
        }
      />

      {/* TODAY stats */}
      <section className="space-y-3">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Today
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard
            icon={<IndianRupee className="h-4 w-4" />}
            label="Revenue"
            value={formatCurrency(m?.revenueToday ?? 0)}
            sub={`${m?.completedToday ?? 0} completed`}
          />
          <StatCard
            icon={<ShoppingBag className="h-4 w-4" />}
            label="Orders"
            value={String(m?.ordersToday ?? 0)}
            sub="placed today"
          />
          <StatCard
            icon={<ClipboardList className="h-4 w-4" />}
            label="Active"
            value={String(m?.activeOrders ?? 0)}
            sub="in the kitchen"
            emphasized={(m?.activeOrders ?? 0) > 0}
          />
          <StatCard
            icon={<BarChart3 className="h-4 w-4" />}
            label="Completed"
            value={String(m?.completedToday ?? 0)}
            sub="orders today"
          />
        </div>
      </section>

      {/* PRODUCTS stats */}
      <section className="space-y-3">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Menu
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard
            icon={<Package className="h-4 w-4" />}
            label="Total Products"
            value={String(m?.totalProducts ?? 0)}
            sub={`${m?.availableProducts ?? 0} available`}
          />
          <StatCard
            icon={<Package className="h-4 w-4" />}
            label="Unavailable"
            value={String((m?.totalProducts ?? 0) - (m?.availableProducts ?? 0))}
            sub="hidden from menu"
          />
          <StatCard
            icon={<Package className="h-4 w-4" />}
            label="Low Stock"
            value={String(m?.lowStockCount ?? 0)}
            sub="near threshold"
          />
          <StatCard
            icon={<Package className="h-4 w-4" />}
            label="Out of Stock"
            value={String(m?.outOfStockCount ?? 0)}
            sub="need refill"
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Live orders */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base">Live Orders</CardTitle>
              <CardDescription>Currently in the kitchen queue</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/orders/live">
                View all
                <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {(m?.liveOrders ?? []).length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<ClipboardList className="h-6 w-6" />}
                  title="All caught up!"
                  description="No active orders right now."
                />
              </div>
            ) : (
              <ul className="divide-y">
                {(m?.liveOrders ?? []).map((o) => {
                  const itemCount = o.items.reduce((s, i) => s + i.quantity, 0);
                  const preview = o.items
                    .slice(0, 2)
                    .map((i) => `${i.quantity}× ${i.name}`)
                    .join(", ");
                  return (
                    <li
                      key={o.id}
                      className="flex items-center gap-3 px-6 py-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold tabular-nums">
                            #{o.orderNumber}
                          </span>
                          <OrderStatusBadge status={o.status} />
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {preview}
                          {o.items.length > 2 && ` +${o.items.length - 2} more`}
                          {" · "}
                          {itemCount} item{itemCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums">
                          {formatCurrency(o.total)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatElapsed(o.createdAt)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Top items */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Top Items</CardTitle>
            <CardDescription>By quantity sold today.</CardDescription>
          </CardHeader>
          <CardContent>
            {(m?.topItems ?? []).length === 0 ? (
              <EmptyState
                icon={<BarChart3 className="h-6 w-6" />}
                title="No sales yet"
                description="Complete a customer order to see best-sellers here."
              />
            ) : (
              <ul className="space-y-4">
                {(m?.topItems ?? []).map((item, idx) => {
                  const max = m!.topItems[0].quantity;
                  const pct = max > 0 ? (item.quantity / max) * 100 : 0;
                  return (
                    <li key={item.productId ?? item.name} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-muted text-[10px] font-semibold text-muted-foreground">
                            {idx + 1}
                          </span>
                          <span className="truncate font-medium">{item.name}</span>
                        </span>
                        <span className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                          {item.quantity} sold
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
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  emphasized,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  emphasized?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div
          className={
            "flex h-9 w-9 items-center justify-center rounded-lg " +
            (emphasized
              ? "bg-warning/15 text-warning"
              : "bg-primary/10 text-primary")
          }
        >
          {icon}
        </div>
        <div className="mt-3">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-xl font-bold sm:text-2xl tabular-nums">
            {value}
          </p>
          {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
