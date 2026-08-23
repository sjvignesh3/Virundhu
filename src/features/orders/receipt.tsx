"use client";

import type { Order, Store } from "@/lib/domain/types";
import { formatCurrency } from "@/lib/utils";

/**
 * 80mm thermal-receipt-styled component. Rendered off-screen and made visible
 * only during `window.print()` via the `.print-only` media query in the page.
 */
export function Receipt({ store, order }: { store: Store; order: Order }) {
  return (
    <div className="receipt">
      <div className="text-center">
        <p className="text-base font-bold uppercase">{store.name}</p>
        {store.tamilName && <p className="text-xs">{store.tamilName}</p>}
        {store.address && <p className="text-[10px]">{store.address}</p>}
        {store.phone && <p className="text-[10px]">{store.phone}</p>}
      </div>
      <div className="my-2 border-y border-dashed py-1 text-center text-xs">
        <p className="font-semibold">#{order.orderNumber}</p>
        <p>{new Date(order.createdAt).toLocaleString("en-IN")}</p>
      </div>
      {(order.customer.name || order.customer.phone) && (
        <div className="text-[11px]">
          {order.customer.name && <p>Customer: {order.customer.name}</p>}
          {order.customer.phone && <p>Phone: {order.customer.phone}</p>}
        </div>
      )}
      <table className="mt-2 w-full text-[11px]">
        <thead>
          <tr className="border-b border-dashed">
            <th className="text-left font-normal">Item</th>
            <th className="text-right font-normal">Qty</th>
            <th className="text-right font-normal">Amt</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((it) => (
            <tr key={it.productId}>
              <td>{it.name}</td>
              <td className="text-right tabular-nums">{it.quantity}</td>
              <td className="text-right tabular-nums">{formatCurrency(it.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 border-t border-dashed pt-1 text-[11px]">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatCurrency(order.subtotal)}</span>
        </div>
        <div className="flex justify-between font-bold">
          <span>Total</span>
          <span className="tabular-nums">{formatCurrency(order.total)}</span>
        </div>
        <p className="mt-1 text-[10px]">
          Paid via {order.paymentMethod} · {order.paymentStatus}
        </p>
      </div>
      {order.customer.note && (
        <p className="mt-2 text-[10px]">Note: {order.customer.note}</p>
      )}
      <p className="mt-3 text-center text-[10px]">— Thank you! Come again —</p>
    </div>
  );
}
