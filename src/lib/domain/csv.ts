/**
 * Client-side CSV serialization for Phase 1 reports export.
 *
 * We deliberately hand-roll RFC 4180 quoting rather than pulling in a CSV
 * library — the field set is tiny and stable, and this keeps the bundle
 * lean. Excel-compatible: CRLF line endings, quote fields containing
 * comma / quote / newline, double-up embedded quotes.
 */

import type { Order } from "./types";

/** Escapes a single cell for CSV output. */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Joins a row array into a single CSV line. */
export function csvRow(cells: unknown[]): string {
  return cells.map(escapeCsvCell).join(",");
}

/**
 * Serialises a list of orders (already filtered by the caller) to a CSV
 * string suitable for Excel / Google Sheets. One row per order — items are
 * summarised in an `items` column as `"Name x2; Other x1"` to keep the
 * output flat and pivot-friendly.
 */
export function ordersToCsv(orders: Order[]): string {
  const header = [
    "order_number",
    "created_at",
    "status",
    "payment_status",
    "payment_method",
    "customer_name",
    "customer_phone",
    "items",
    "item_count",
    "subtotal",
    "total",
  ];

  const rows = orders.map((o) => {
    const itemSummary = o.items
      .map((it) => `${it.name} x${it.quantity}`)
      .join("; ");
    const itemCount = o.items.reduce((s, it) => s + it.quantity, 0);
    return csvRow([
      o.orderNumber,
      o.createdAt,
      o.status,
      o.paymentStatus,
      o.paymentMethod,
      o.customer.name ?? "",
      o.customer.phone ?? "",
      itemSummary,
      itemCount,
      o.subtotal,
      o.total,
    ]);
  });

  // BOM so Excel opens UTF-8 (Tamil names, ₹) correctly.
  return "\ufeff" + [csvRow(header), ...rows].join("\r\n");
}

/** Suggested filename for a report window. */
export function csvFilename(prefix: string, range: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${prefix}_${range}_${stamp}.csv`;
}
