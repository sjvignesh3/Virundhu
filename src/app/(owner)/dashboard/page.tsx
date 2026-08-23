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
import {
  computeProductMetrics,
  computeTodayMetrics,
  computeTopItems,
} from "@/lib/domain/dashboard-metrics";
import { ACTIVE_STATUS_FLOW } from "@/lib/domain/order-status";
import { formatCurrency } from "@/lib/utils";
import type { Order, Product } from "@/lib/domain/types";
import type { Repos } from "@/lib/repositories";

export default function DashboardPage() {
  useTicker(30_000);
  const repos = useRepos();
  const { store, loading: storeLoading } = useDemoStore();

  const ordersLoader = React.useCallback(
    async (r: Repos) => (store ? r.orders.list(store.id) : ([] as Order[])),
    [store],
  );
  const productsLoader = React.useCallback(
    async (r: Repos) => (store ? r.products.list(store.id) : ([] as Product[])),
    [store],
  );

  const { data: orders, loading: ordersLoading } = useCollection(
    "orders",
    ordersLoader,
  );
  const { data: products, loading: productsLoading } = useCollection(
    "products",
    productsLoader,
  );

  const bootLoading =
    !repos || storeLoading || (ordersLoading && !orders) || (productsLoading && !products);

  const today = React.useMemo(
    () => computeTodayMetrics(orders ?? []),
    [orders],
  );
  const productStats = React.useMemo(
    () => computeProductMetrics(products ?? []),
    [products],
  );
  const topItems = React.useMemo(
    () => computeTopItems(orders ?? [], 5),
    [orders],
  );
  const liveOrders = React.useMemo(
    () =>
      (orders ?? [])
        .filter((o) => (ACTIVE_STATUS_FLOW as readonly string[]).includes(o.status))
        .slice(0, 5),
    [orders],
  );

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
            value={formatCurrency(today.revenueToday)}
            sub={`${today.completedToday} completed`}
          />
          <StatCard
            icon={<ShoppingBag className="h-4 w-4" />}
            label="Orders"
            value={String(today.ordersToday)}
            sub="placed today"
          />
          <StatCard
            icon={<ClipboardList className="h-4 w-4" />}
            label="Active"
            value={String(today.activeOrders)}
            sub="in the kitchen"
            emphasized={today.activeOrders > 0}
          />
          <StatCard
            icon={<BarChart3 className="h-4 w-4" />}
            label="Completed"
            value={String(today.completedToday)}
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
            value={String(productStats.total)}
            sub={`${productStats.available} available`}
          />
          <StatCard
            icon={<Package className="h-4 w-4" />}
            label="Unavailable"
            value={String(productStats.unavailable)}
            sub="hidden from menu"
          />
          <StatCard
            icon={<Package className="h-4 w-4" />}
            label="Low Stock"
            value={String(productStats.lowStock)}
            sub="near threshold"
          />
          <StatCard
            icon={<Package className="h-4 w-4" />}
            label="Out of Stock"
            value={String(productStats.outOfStock)}
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
            {liveOrders.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<ClipboardList className="h-6 w-6" />}
                  title="All caught up!"
                  description="No active orders right now."
                />
              </div>
            ) : (
              <ul className="divide-y">
                {liveOrders.map((o) => {
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
            <CardDescription>By quantity sold, all time.</CardDescription>
          </CardHeader>
          <CardContent>
            {topItems.length === 0 ? (
              <EmptyState
                icon={<BarChart3 className="h-6 w-6" />}
                title="No sales yet"
                description="Complete a customer order to see best-sellers here."
              />
            ) : (
              <ul className="space-y-4">
                {topItems.map((item, idx) => {
                  const max = topItems[0].quantity;
                  const pct = max > 0 ? (item.quantity / max) * 100 : 0;
                  return (
                    <li key={item.productId} className="space-y-1.5">
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
