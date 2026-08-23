/**
 * Pure aggregation helpers for the Owner Dashboard.
 *
 * All functions are storage-agnostic and side-effect-free so they can be
 * unit-tested without React / localStorage / repos.
 *
 * Rule of thumb: any number shown on the Dashboard MUST come out of a helper
 * in this file. UI components never do their own math.
 */

import type { Order, OrderStatus, Product } from "./types";

/** Timezone-safe start-of-local-day as an ISO string. */
export function startOfTodayIso(now: Date = new Date()): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export interface TodayMetrics {
  /** Every order whose createdAt >= start-of-today (any status incl. cancelled). */
  ordersToday: number;
  /** Orders that reached COMPLETED today (uses completedAt when available). */
  completedToday: number;
  /** Orders still in a non-terminal status right now (regardless of when placed). */
  activeOrders: number;
  /** Sum of `total` across today's COMPLETED orders. */
  revenueToday: number;
}

const ACTIVE_STATUSES: readonly OrderStatus[] = [
  "NEW",
  "ACCEPTED",
  "PREPARING",
  "READY",
];

/** Aggregates the "TODAY" summary strip on the dashboard. */
export function computeTodayMetrics(
  orders: readonly Order[],
  now: Date = new Date(),
): TodayMetrics {
  const startIso = startOfTodayIso(now);
  let ordersToday = 0;
  let completedToday = 0;
  let activeOrders = 0;
  let revenueToday = 0;

  for (const o of orders) {
    if (o.createdAt >= startIso) ordersToday += 1;

    const completedStamp = o.completedAt ?? o.updatedAt;
    if (o.status === "COMPLETED" && completedStamp >= startIso) {
      completedToday += 1;
      revenueToday += o.total;
    }

    if ((ACTIVE_STATUSES as readonly string[]).includes(o.status)) {
      activeOrders += 1;
    }
  }

  return { ordersToday, completedToday, activeOrders, revenueToday };
}

export interface ProductMetrics {
  total: number;
  available: number;
  unavailable: number;
  lowStock: number;
  outOfStock: number;
}

/** Aggregates the "PRODUCTS" summary strip. Stock fields are optional in P1. */
export function computeProductMetrics(products: readonly Product[]): ProductMetrics {
  let available = 0;
  let unavailable = 0;
  let lowStock = 0;
  let outOfStock = 0;

  for (const p of products) {
    if (p.available) available += 1;
    else unavailable += 1;

    if (typeof p.stock === "number") {
      if (p.stock <= 0) outOfStock += 1;
      else if (
        typeof p.lowStockThreshold === "number" &&
        p.stock <= p.lowStockThreshold
      ) {
        lowStock += 1;
      }
    }
  }

  return {
    total: products.length,
    available,
    unavailable,
    lowStock,
    outOfStock,
  };
}

export interface TopItem {
  productId: string;
  name: string;
  quantity: number;
  revenue: number;
}

/**
 * Top-selling items across the provided (COMPLETED) orders, sorted by qty.
 * Callers decide the window (today / 7d / all) by pre-filtering `orders`.
 */
export function computeTopItems(
  orders: readonly Order[],
  limit = 5,
): TopItem[] {
  const map = new Map<string, TopItem>();
  for (const o of orders) {
    if (o.status !== "COMPLETED") continue;
    for (const it of o.items) {
      const cur =
        map.get(it.productId) ??
        { productId: it.productId, name: it.name, quantity: 0, revenue: 0 };
      cur.quantity += it.quantity;
      cur.revenue += it.lineTotal;
      map.set(it.productId, cur);
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
    .slice(0, limit);
}
