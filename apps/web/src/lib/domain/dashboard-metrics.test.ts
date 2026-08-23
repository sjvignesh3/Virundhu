import { describe, it, expect } from "vitest";
import {
  computeProductMetrics,
  computeTodayMetrics,
  computeTopItems,
  startOfTodayIso,
} from "./dashboard-metrics";
import type { Order, OrderItem, Product } from "./types";

const NOW = new Date("2024-06-10T15:00:00.000Z");
const START = startOfTodayIso(NOW); // start-of-local-day for the test env

function item(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    productId: "p1",
    name: "Idli",
    unit: "plate",
    unitPrice: 30,
    quantity: 1,
    lineTotal: 30,
    ...overrides,
  };
}

function order(overrides: Partial<Order> = {}): Order {
  const createdAt = overrides.createdAt ?? START; // default = today
  return {
    id: "o1",
    orderNumber: "FC-1001",
    storeId: "s1",
    customer: {},
    items: [item()],
    subtotal: 30,
    total: 30,
    paymentMethod: "SIMULATED",
    paymentStatus: "PAID",
    status: "NEW",
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    storeId: "s1",
    categoryId: "c1",
    name: "Idli",
    price: 30,
    unit: "plate",
    available: true,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("computeTodayMetrics", () => {
  it("returns zeros for an empty list", () => {
    expect(computeTodayMetrics([], NOW)).toEqual({
      ordersToday: 0,
      completedToday: 0,
      activeOrders: 0,
      revenueToday: 0,
    });
  });

  it("counts orders placed today regardless of status", () => {
    const orders = [
      order({ id: "1", status: "NEW" }),
      order({ id: "2", status: "COMPLETED", total: 120, completedAt: START }),
      order({ id: "3", status: "CANCELLED" }),
      order({ id: "old", createdAt: "2024-06-09T10:00:00.000Z", status: "COMPLETED", completedAt: "2024-06-09T10:00:00.000Z" }),
    ];
    const m = computeTodayMetrics(orders, NOW);
    expect(m.ordersToday).toBe(3);
  });

  it("sums revenue and completions only for orders completed today", () => {
    const orders = [
      order({ id: "1", status: "COMPLETED", total: 100, completedAt: START }),
      order({ id: "2", status: "COMPLETED", total: 240, completedAt: START }),
      // Placed yesterday, completed today — still counts revenue today.
      order({
        id: "3",
        status: "COMPLETED",
        total: 50,
        createdAt: "2024-06-09T20:00:00.000Z",
        completedAt: START,
      }),
      // Completed yesterday — must NOT count.
      order({
        id: "4",
        status: "COMPLETED",
        total: 999,
        createdAt: "2024-06-09T10:00:00.000Z",
        completedAt: "2024-06-09T11:00:00.000Z",
      }),
    ];
    const m = computeTodayMetrics(orders, NOW);
    expect(m.completedToday).toBe(3);
    expect(m.revenueToday).toBe(390);
  });

  it("counts every non-terminal order as active regardless of day", () => {
    const orders = [
      order({ id: "1", status: "NEW" }),
      order({ id: "2", status: "ACCEPTED" }),
      order({ id: "3", status: "PREPARING" }),
      order({ id: "4", status: "READY" }),
      order({ id: "5", status: "COMPLETED", completedAt: START }),
      order({ id: "6", status: "CANCELLED" }),
      order({
        id: "old-active",
        status: "PREPARING",
        createdAt: "2024-06-09T10:00:00.000Z",
      }),
    ];
    const m = computeTodayMetrics(orders, NOW);
    expect(m.activeOrders).toBe(5);
  });
});

describe("computeProductMetrics", () => {
  it("returns zeros for empty", () => {
    expect(computeProductMetrics([])).toEqual({
      total: 0,
      available: 0,
      unavailable: 0,
      lowStock: 0,
      outOfStock: 0,
    });
  });

  it("counts availability, low stock and out of stock", () => {
    const products = [
      product({ id: "a", available: true }),
      product({ id: "b", available: false }),
      product({ id: "c", available: true, stock: 0 }),
      product({ id: "d", available: true, stock: 2, lowStockThreshold: 5 }),
      product({ id: "e", available: true, stock: 20, lowStockThreshold: 5 }),
    ];
    expect(computeProductMetrics(products)).toEqual({
      total: 5,
      available: 4,
      unavailable: 1,
      lowStock: 1,
      outOfStock: 1,
    });
  });
});

describe("computeTopItems", () => {
  it("returns empty for no completed orders", () => {
    expect(computeTopItems([order({ status: "NEW" })])).toEqual([]);
  });

  it("aggregates completed order items by productId and sorts by qty", () => {
    const orders: Order[] = [
      order({
        id: "1",
        status: "COMPLETED",
        completedAt: START,
        items: [
          item({ productId: "idli", name: "Idli", quantity: 2, lineTotal: 60 }),
          item({ productId: "dosa", name: "Dosa", quantity: 1, unitPrice: 60, lineTotal: 60 }),
        ],
      }),
      order({
        id: "2",
        status: "COMPLETED",
        completedAt: START,
        items: [
          item({ productId: "idli", name: "Idli", quantity: 3, lineTotal: 90 }),
        ],
      }),
      // Non-completed must be ignored.
      order({
        id: "3",
        status: "NEW",
        items: [item({ productId: "vada", name: "Vada", quantity: 99, lineTotal: 999 })],
      }),
    ];
    const top = computeTopItems(orders);
    expect(top).toEqual([
      { productId: "idli", name: "Idli", quantity: 5, revenue: 150 },
      { productId: "dosa", name: "Dosa", quantity: 1, revenue: 60 },
    ]);
  });

  it("respects the limit", () => {
    const orders: Order[] = [
      order({
        id: "1",
        status: "COMPLETED",
        completedAt: START,
        items: [
          item({ productId: "a", name: "A", quantity: 5, lineTotal: 50 }),
          item({ productId: "b", name: "B", quantity: 4, lineTotal: 40 }),
          item({ productId: "c", name: "C", quantity: 3, lineTotal: 30 }),
        ],
      }),
    ];
    expect(computeTopItems(orders, 2)).toHaveLength(2);
  });
});
