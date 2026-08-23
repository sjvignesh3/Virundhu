import type { OrderItem, Product } from './types';

export interface OrderTotals {
  subtotal: number;
  total: number;
}

/**
 * Compute subtotal + total from order items.
 *
 * Phase 1: no taxes, no discounts, no delivery fees → `total === subtotal`.
 * The separation is preserved so we can add these later without breaking callers.
 *
 * Each item's `lineTotal` is treated as authoritative (already computed at
 * insertion via `buildOrderItem`), so this function is a pure sum. If callers
 * mutate quantity, they must rebuild the item first.
 */
export function computeOrderTotals(items: readonly OrderItem[]): OrderTotals {
  let subtotal = 0;
  for (const item of items) {
    subtotal += item.lineTotal;
  }
  return { subtotal, total: subtotal };
}

/**
 * Build a fresh `OrderItem` from a product + quantity, snapshotting price/name
 * so that later product edits don't retroactively change historical orders.
 */
export function buildOrderItem(product: Product, quantity: number): OrderItem {
  if (quantity <= 0 || !Number.isFinite(quantity)) {
    throw new Error(`buildOrderItem: quantity must be a positive number, got ${quantity}`);
  }
  const qty = Math.floor(quantity);
  return {
    productId: product.id,
    name: product.name,
    tamilName: product.tamilName,
    unit: product.unit,
    unitPrice: product.price,
    quantity: qty,
    lineTotal: product.price * qty,
  };
}
