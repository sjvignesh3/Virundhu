/**
 * Order creation service — the one place order-placement rules live.
 *
 * Extracted from `CartSheet` so:
 *   - the customer UI stays presentational,
 *   - checkout logic is unit-testable without React,
 *   - future channels (owner-side POS, phone-in orders) share validation.
 *
 * The service is *pure orchestration*: it validates business rules, calls the
 * payment service, snapshots order items via `buildOrderItem`, then delegates
 * persistence + id/orderNumber assignment to `OrderRepo.create`.
 */

import type {
  Order,
  Product,
  Store,
  Customer,
} from "@/lib/domain/types";
import { buildOrderItem, computeOrderTotals } from "@/lib/domain/totals";
import type { OrderRepo, ProductRepo, StoreRepo } from "@/lib/repositories/types";
import type { PaymentService } from "./payment-service";

// -- Errors -------------------------------------------------------------------

export class OrderValidationError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "STORE_NOT_FOUND"
      | "STORE_CLOSED"
      | "EMPTY_CART"
      | "PRODUCT_NOT_FOUND"
      | "PRODUCT_UNAVAILABLE"
      | "CROSS_STORE_PRODUCT"
      | "BELOW_MIN_ORDER"
      | "PAYMENT_FAILED",
  ) {
    super(message);
    this.name = "OrderValidationError";
  }
}

// -- Input shape --------------------------------------------------------------

export interface CartLineInput {
  productId: string;
  quantity: number;
}

export interface CreateOrderInput {
  storeId: string;
  customer: Customer;
  lines: readonly CartLineInput[];
}

export interface CreateOrderDeps {
  stores: Pick<StoreRepo, "get">;
  products: Pick<ProductRepo, "get">;
  orders: Pick<OrderRepo, "create">;
  payment: PaymentService;
}

// -- Service ------------------------------------------------------------------

/**
 * Place a new order. Validates store status + min-order + product availability,
 * runs payment, then persists via `OrderRepo.create`. Returns the persisted
 * Order (with id + orderNumber assigned).
 *
 * Throws `OrderValidationError` for any business-rule violation. Callers can
 * inspect `err.code` to map to a UI message.
 */
export async function createOrder(
  input: CreateOrderInput,
  deps: CreateOrderDeps,
): Promise<Order> {
  // 1. Resolve store.
  const store = await deps.stores.get(input.storeId);
  if (!store) {
    throw new OrderValidationError(`Store not found: ${input.storeId}`, "STORE_NOT_FOUND");
  }
  if (store.status !== "OPEN") {
    throw new OrderValidationError(`${store.name} is closed right now.`, "STORE_CLOSED");
  }

  // 2. Non-empty cart.
  if (!input.lines.length) {
    throw new OrderValidationError("Cart is empty.", "EMPTY_CART");
  }

  // 3. Resolve every product and validate.
  const products: Product[] = [];
  for (const line of input.lines) {
    if (line.quantity <= 0) continue;
    const product = await deps.products.get(line.productId);
    if (!product) {
      throw new OrderValidationError(
        `Product not found: ${line.productId}`,
        "PRODUCT_NOT_FOUND",
      );
    }
    if (product.storeId !== store.id) {
      throw new OrderValidationError(
        `Product ${product.name} does not belong to ${store.name}.`,
        "CROSS_STORE_PRODUCT",
      );
    }
    if (!product.available) {
      throw new OrderValidationError(
        `${product.name} is no longer available.`,
        "PRODUCT_UNAVAILABLE",
      );
    }
    products.push(product);
  }

  // 4. Snapshot items + compute totals.
  const items = input.lines
    .filter((l) => l.quantity > 0)
    .map((line, idx) => buildOrderItem(products[idx], line.quantity));

  if (!items.length) {
    throw new OrderValidationError("Cart is empty.", "EMPTY_CART");
  }

  const { subtotal, total } = computeOrderTotals(items);

  // 5. Min-order gate.
  const minOrder = store.minOrderValue ?? 0;
  if (minOrder > 0 && subtotal < minOrder) {
    throw new OrderValidationError(
      `Minimum order is ₹${minOrder}.`,
      "BELOW_MIN_ORDER",
    );
  }

  // 6. Charge (simulated in Phase 1).
  const payment = await deps.payment.charge(total);
  if (payment.status === "FAILED") {
    throw new OrderValidationError("Payment failed. Please try again.", "PAYMENT_FAILED");
  }

  // 7. Persist. Repo assigns id + orderNumber + timestamps.
  const order = await deps.orders.create({
    storeId: store.id,
    customer: {
      name: input.customer.name?.trim() || undefined,
      phone: input.customer.phone?.trim() || undefined,
      note: input.customer.note?.trim() || undefined,
    },
    items,
    subtotal,
    total,
    paymentMethod: payment.method,
    paymentStatus: payment.status,
    status: "NEW",
  });

  return order;
}

/** Convenience — pass an entire `Store` instead of hitting the repo. */
export async function createOrderForStore(
  store: Store,
  input: Omit<CreateOrderInput, "storeId">,
  deps: Omit<CreateOrderDeps, "stores">,
): Promise<Order> {
  return createOrder(
    { ...input, storeId: store.id },
    { ...deps, stores: { get: async (id) => (id === store.id ? store : null) } },
  );
}
