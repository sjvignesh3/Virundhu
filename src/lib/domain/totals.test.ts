import { describe, it, expect } from "vitest";
import { buildOrderItem, computeOrderTotals } from "./totals";
import type { Product } from "./types";

function makeProduct(overrides: Partial<Product> = {}): Product {
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

describe("buildOrderItem", () => {
  it("snapshots price/name/tamilName/unit onto the line", () => {
    const p = makeProduct({ price: 40, name: "Dosa", tamilName: "தோசை", unit: "piece" });
    const item = buildOrderItem(p, 2);
    expect(item.name).toBe("Dosa");
    expect(item.tamilName).toBe("தோசை");
    expect(item.unit).toBe("piece");
    expect(item.unitPrice).toBe(40);
    expect(item.quantity).toBe(2);
    expect(item.lineTotal).toBe(80);
    expect(item.productId).toBe(p.id);
  });

  it("floors non-integer quantities", () => {
    const p = makeProduct({ price: 10 });
    const item = buildOrderItem(p, 2.9);
    expect(item.quantity).toBe(2);
    expect(item.lineTotal).toBe(20);
  });

  it("rejects zero / negative / non-finite quantities", () => {
    const p = makeProduct();
    expect(() => buildOrderItem(p, 0)).toThrow();
    expect(() => buildOrderItem(p, -1)).toThrow();
    expect(() => buildOrderItem(p, Number.NaN)).toThrow();
    expect(() => buildOrderItem(p, Number.POSITIVE_INFINITY)).toThrow();
  });
});

describe("computeOrderTotals", () => {
  it("sums lineTotals as subtotal and total (Phase 1: no tax)", () => {
    const items = [
      buildOrderItem(makeProduct({ id: "p1", price: 30 }), 2),
      buildOrderItem(makeProduct({ id: "p2", price: 15 }), 3),
    ];
    const { subtotal, total } = computeOrderTotals(items);
    expect(subtotal).toBe(105);
    expect(total).toBe(105);
  });

  it("returns zeros for empty item list", () => {
    expect(computeOrderTotals([])).toEqual({ subtotal: 0, total: 0 });
  });

  it("does not recompute lineTotal (trusts snapshot)", () => {
    // If a caller manually forges a lineTotal, we accept it — this documents
    // the contract that mutation requires rebuilding the item.
    const forged = {
      productId: "p1",
      name: "x",
      unit: "plate" as const,
      unitPrice: 30,
      quantity: 2,
      lineTotal: 999,
    };
    expect(computeOrderTotals([forged])).toEqual({ subtotal: 999, total: 999 });
  });
});
