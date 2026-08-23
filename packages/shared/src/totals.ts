/**
 * Pure total-calculation helpers. Backend uses these authoritatively during
 * order creation; frontend uses them for cart previews. Same code → same
 * totals → no drift.
 */

export interface OrderableLine {
  unitPrice: number;
  quantity: number;
}

export interface OrderTotals {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
}

export interface TotalsOptions {
  /** Absolute discount to subtract from subtotal (never below 0). */
  discountAmount?: number;
  /** Tax as a percentage of (subtotal - discount). E.g. 5 = 5%. */
  taxPercent?: number;
}

export function computeLineSubtotal(line: OrderableLine): number {
  return roundMoney(line.unitPrice * line.quantity);
}

export function computeOrderTotals(
  lines: readonly OrderableLine[],
  opts: TotalsOptions = {},
): OrderTotals {
  const subtotal = lines.reduce((s, l) => s + computeLineSubtotal(l), 0);
  const discountAmount = Math.min(subtotal, Math.max(0, opts.discountAmount ?? 0));
  const taxable = Math.max(0, subtotal - discountAmount);
  const taxAmount = opts.taxPercent
    ? roundMoney((taxable * opts.taxPercent) / 100)
    : 0;
  const totalAmount = roundMoney(taxable + taxAmount);
  return {
    subtotal: roundMoney(subtotal),
    discountAmount: roundMoney(discountAmount),
    taxAmount,
    totalAmount,
  };
}

/** Rounds to 2 decimals — matches DECIMAL(10,2) column precision. */
export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Human-friendly order number generator. Prefix is store-scoped so different
 * stores can have overlapping sequences without collision.
 */
export function formatOrderNumber(seq: number, prefix = "FC"): string {
  return `${prefix}-${1000 + seq}`;
}
