import { describe, it, expect, vi, beforeEach } from "vitest";
import { createOrder, OrderValidationError } from "./order-service";
import type { Order, Product, Store } from "@/lib/domain/types";
import type { PaymentService } from "./payment-service";

const openStore: Store = {
  id: "store-1",
  slug: "test",
  name: "Test Cart",
  status: "OPEN",
  language: "en",
  showTamilNames: false,
  showUnavailable: false,
  minOrderValue: 0,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

const closedStore: Store = { ...openStore, id: "store-closed", status: "CLOSED" };

const idli: Product = {
  id: "idli",
  storeId: "store-1",
  categoryId: "cat-1",
  name: "Idli",
  price: 30,
  unit: "plate",
  available: true,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};
const dosa: Product = { ...idli, id: "dosa", name: "Dosa", price: 60 };
const unavailable: Product = { ...idli, id: "gone", name: "Sold Out", available: false };
const foreign: Product = { ...idli, id: "foreign", storeId: "other-store" };

function makeDeps(overrides: {
  store?: Store | null;
  products?: Product[];
  paymentStatus?: "PAID" | "FAILED";
} = {}) {
  const store = overrides.store === undefined ? openStore : overrides.store;
  const productList = overrides.products ?? [idli, dosa];
  const productMap = new Map(productList.map((p) => [p.id, p]));
  const paymentStatus = overrides.paymentStatus ?? "PAID";

  const create = vi.fn(async (draft): Promise<Order> => ({
    ...draft,
    id: "order-generated",
    orderNumber: "FC-1001",
    createdAt: "2024-06-01T10:00:00.000Z",
    updatedAt: "2024-06-01T10:00:00.000Z",
  }));

  const payment: PaymentService = {
    charge: vi.fn(async () => ({
      status: paymentStatus,
      method: "SIMULATED" as const,
      reference: "SIM-TEST",
    })),
  };

  return {
    stores: { get: vi.fn(async (id: string) => (store && store.id === id ? store : null)) },
    products: { get: vi.fn(async (id: string) => productMap.get(id) ?? null) },
    orders: { create },
    payment,
    _create: create,
    _charge: payment.charge as ReturnType<typeof vi.fn>,
  };
}

describe("createOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("happy path: snapshots items, computes totals, calls payment, persists", async () => {
    const deps = makeDeps();
    const order = await createOrder(
      {
        storeId: "store-1",
        customer: { name: "Ravi", phone: "9000000000" },
        lines: [
          { productId: "idli", quantity: 2 },
          { productId: "dosa", quantity: 1 },
        ],
      },
      deps,
    );

    expect(order.id).toBe("order-generated");
    expect(order.orderNumber).toBe("FC-1001");

    // Payment charged with the correct total (2×30 + 1×60 = 120).
    expect(deps._charge).toHaveBeenCalledWith(120);

    // Persisted draft is well-formed.
    const draft = deps._create.mock.calls[0][0];
    expect(draft.storeId).toBe("store-1");
    expect(draft.subtotal).toBe(120);
    expect(draft.total).toBe(120);
    expect(draft.status).toBe("NEW");
    expect(draft.paymentStatus).toBe("PAID");
    expect(draft.paymentMethod).toBe("SIMULATED");
    expect(draft.items).toHaveLength(2);
    expect(draft.items[0]).toMatchObject({ productId: "idli", quantity: 2, lineTotal: 60 });
    expect(draft.items[1]).toMatchObject({ productId: "dosa", quantity: 1, lineTotal: 60 });
    expect(draft.customer).toEqual({ name: "Ravi", phone: "9000000000" });
  });

  it("trims customer strings and drops empty ones", async () => {
    const deps = makeDeps();
    await createOrder(
      {
        storeId: "store-1",
        customer: { name: "  ", phone: " 9000000000 ", note: "" },
        lines: [{ productId: "idli", quantity: 1 }],
      },
      deps,
    );
    const draft = deps._create.mock.calls[0][0];
    expect(draft.customer).toEqual({ phone: "9000000000" });
  });

  it("rejects when store is not found", async () => {
    const deps = makeDeps({ store: null });
    await expect(
      createOrder(
        { storeId: "missing", customer: {}, lines: [{ productId: "idli", quantity: 1 }] },
        deps,
      ),
    ).rejects.toMatchObject({ code: "STORE_NOT_FOUND" });
    expect(deps._create).not.toHaveBeenCalled();
  });

  it("rejects when store is closed", async () => {
    const deps = makeDeps({ store: closedStore });
    await expect(
      createOrder(
        {
          storeId: "store-closed",
          customer: {},
          lines: [{ productId: "idli", quantity: 1 }],
        },
        deps,
      ),
    ).rejects.toMatchObject({ code: "STORE_CLOSED" });
    expect(deps._charge).not.toHaveBeenCalled();
    expect(deps._create).not.toHaveBeenCalled();
  });

  it("rejects an empty cart", async () => {
    const deps = makeDeps();
    await expect(
      createOrder({ storeId: "store-1", customer: {}, lines: [] }, deps),
    ).rejects.toMatchObject({ code: "EMPTY_CART" });
  });

  it("rejects when all lines have zero quantity", async () => {
    const deps = makeDeps();
    await expect(
      createOrder(
        {
          storeId: "store-1",
          customer: {},
          lines: [{ productId: "idli", quantity: 0 }],
        },
        deps,
      ),
    ).rejects.toMatchObject({ code: "EMPTY_CART" });
  });

  it("rejects unknown products", async () => {
    const deps = makeDeps();
    await expect(
      createOrder(
        {
          storeId: "store-1",
          customer: {},
          lines: [{ productId: "ghost", quantity: 1 }],
        },
        deps,
      ),
    ).rejects.toMatchObject({ code: "PRODUCT_NOT_FOUND" });
  });

  it("rejects unavailable products", async () => {
    const deps = makeDeps({ products: [idli, unavailable] });
    await expect(
      createOrder(
        {
          storeId: "store-1",
          customer: {},
          lines: [{ productId: "gone", quantity: 1 }],
        },
        deps,
      ),
    ).rejects.toMatchObject({ code: "PRODUCT_UNAVAILABLE" });
  });

  it("rejects cross-store products", async () => {
    const deps = makeDeps({ products: [foreign] });
    await expect(
      createOrder(
        {
          storeId: "store-1",
          customer: {},
          lines: [{ productId: "foreign", quantity: 1 }],
        },
        deps,
      ),
    ).rejects.toMatchObject({ code: "CROSS_STORE_PRODUCT" });
  });

  it("rejects below-min-order when configured", async () => {
    const deps = makeDeps({ store: { ...openStore, minOrderValue: 100 } });
    await expect(
      createOrder(
        {
          storeId: "store-1",
          customer: {},
          lines: [{ productId: "idli", quantity: 1 }], // 30 < 100
        },
        deps,
      ),
    ).rejects.toMatchObject({ code: "BELOW_MIN_ORDER" });
    expect(deps._charge).not.toHaveBeenCalled();
  });

  it("passes when subtotal exactly meets min-order", async () => {
    const deps = makeDeps({ store: { ...openStore, minOrderValue: 60 } });
    await expect(
      createOrder(
        {
          storeId: "store-1",
          customer: {},
          lines: [{ productId: "idli", quantity: 2 }], // 60 == 60
        },
        deps,
      ),
    ).resolves.toBeDefined();
  });

  it("rejects when payment fails", async () => {
    const deps = makeDeps({ paymentStatus: "FAILED" });
    await expect(
      createOrder(
        {
          storeId: "store-1",
          customer: {},
          lines: [{ productId: "idli", quantity: 1 }],
        },
        deps,
      ),
    ).rejects.toMatchObject({ code: "PAYMENT_FAILED" });
    expect(deps._create).not.toHaveBeenCalled();
  });

  it("uses OrderValidationError so callers can branch on code", async () => {
    const deps = makeDeps({ store: closedStore });
    try {
      await createOrder(
        {
          storeId: "store-closed",
          customer: {},
          lines: [{ productId: "idli", quantity: 1 }],
        },
        deps,
      );
      expect.fail("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(OrderValidationError);
    }
  });
});
