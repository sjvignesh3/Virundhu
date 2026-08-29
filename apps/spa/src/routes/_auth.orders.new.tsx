/**
 * New Order — walk-in counter sales (Stage 9).
 *
 * The highest-frequency owner flow: a customer orders at the shop with no
 * phone. Optimized for taps: tap a product to add it, tap − to remove,
 * Save. The RPC (`orders_create_counter`) writes the order already
 * COMPLETED + PAID, so it lands in History and Dashboard revenue and never
 * touches the Live Orders board.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  categoryKeys,
  categoriesRepo,
  dashboardKeys,
  orderKeys,
  ordersRepo,
  productKeys,
  productsRepo,
} from "@virundhu/client";
import type { ProductRow } from "@virundhu/shared";
import { useActiveStoreId } from "@/lib/useActiveStoreId";
import { NoStoreState } from "@/components/NoStoreState";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/cn";

export const Route = createFileRoute("/_auth/orders/new")({
  component: NewOrderPage,
});

function NewOrderPage() {
  const storeId = useActiveStoreId();
  if (!storeId) return <NoStoreState />;
  return <NewOrderInner storeId={storeId} />;
}

function NewOrderInner({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const products = useQuery({
    queryKey: productKeys.list(storeId),
    queryFn: () => productsRepo.list(storeId),
  });
  const categories = useQuery({
    queryKey: categoryKeys.list(storeId),
    queryFn: () => categoriesRepo.list(storeId),
  });

  const [catFilter, setCatFilter] = useState<string>("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [payment, setPayment] = useState<"CASH" | "UPI">("CASH");
  const [customerName, setCustomerName] = useState("");

  const available = useMemo(
    () => (products.data ?? []).filter((p) => p.is_available),
    [products.data],
  );
  const visible = useMemo(
    () => (catFilter ? available.filter((p) => p.category_id === catFilter) : available),
    [available, catFilter],
  );

  const lines = useMemo(
    () =>
      available
        .filter((p) => (qty[p.id] ?? 0) > 0)
        .map((p) => ({ product: p, quantity: qty[p.id] as number })),
    [available, qty],
  );
  const itemCount = lines.reduce((s, l) => s + l.quantity, 0);
  const subtotal = lines.reduce((s, l) => s + l.product.price * l.quantity, 0);

  function bump(id: string, delta: number) {
    setQty((q) => {
      const next = Math.max(0, (q[id] ?? 0) + delta);
      const copy = { ...q };
      if (next === 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });
  }

  const save = useMutation({
    mutationFn: () =>
      ordersRepo.createCounter(
        storeId,
        lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
        {
          paymentMethod: payment,
          customerName: customerName.trim() || undefined,
        },
      ),
    onSuccess: (order) => {
      toast.success(
        `Saved #${order.order_number} · ${formatCurrency(order.total_amount)} (${payment.toLowerCase()})`,
      );
      setQty({});
      setCustomerName("");
      qc.invalidateQueries({ queryKey: dashboardKeys.all });
      qc.invalidateQueries({ queryKey: orderKeys.all });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Save failed"),
  });

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-4 pb-40 md:pb-32">
      <div>
        <h1 className="text-xl md:text-2xl font-semibold">New Order</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Counter sale — tap items, save. Goes straight to History &amp; Dashboard.
        </p>
      </div>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
        <Chip label="All" active={catFilter === ""} onClick={() => setCatFilter("")} />
        {categories.data?.map((c) => (
          <Chip
            key={c.id}
            label={c.name}
            active={catFilter === c.id}
            onClick={() => setCatFilter(c.id)}
          />
        ))}
      </div>

      {/* Product grid */}
      {products.isLoading ? (
        <div className="text-sm text-neutral-500">Loading menu…</div>
      ) : products.error ? (
        <div className="card p-4 border-red-200 bg-red-50 text-red-700 text-sm">
          {(products.error as Error).message}
        </div>
      ) : visible.length === 0 ? (
        <div className="card p-8 text-center text-neutral-500 text-sm">
          No available products{catFilter ? " in this category" : ""}.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {visible.map((p) => (
            <ProductTile
              key={p.id}
              product={p}
              qty={qty[p.id] ?? 0}
              onAdd={() => bump(p.id, 1)}
              onRemove={() => bump(p.id, -1)}
            />
          ))}
        </div>
      )}

      {/* Sticky order bar — above the mobile tab bar */}
      <div className="fixed inset-x-0 bottom-[68px] md:bottom-0 z-30 md:left-60 border-t border-neutral-200 bg-white/95 backdrop-blur">
        <div className="max-w-5xl mx-auto p-3 md:px-6 flex flex-col sm:flex-row sm:items-center gap-2.5">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="font-bold whitespace-nowrap tabular-nums">
              {itemCount} item{itemCount === 1 ? "" : "s"} · {formatCurrency(subtotal)}
            </div>
            <input
              className="input !py-1.5 flex-1 min-w-0 max-w-[200px]"
              placeholder="Customer (optional)"
              aria-label="Customer name (optional)"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-neutral-200 overflow-hidden" role="radiogroup" aria-label="Payment method">
              {(["CASH", "UPI"] as const).map((m) => (
                <button
                  key={m}
                  role="radio"
                  aria-checked={payment === m}
                  onClick={() => setPayment(m)}
                  className={cn(
                    "px-3.5 py-2 text-sm font-semibold",
                    payment === m ? "bg-brand text-white" : "text-neutral-500 hover:bg-neutral-100",
                  )}
                >
                  {m === "CASH" ? "Cash" : "UPI"}
                </button>
              ))}
            </div>
            {itemCount > 0 ? (
              <button className="btn btn-outline !px-3" onClick={() => setQty({})}>
                Clear
              </button>
            ) : null}
            <button
              className="btn btn-primary !px-6"
              disabled={itemCount === 0 || save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? "Saving…" : "Save order"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition-colors",
        active
          ? "bg-brand text-white border-brand"
          : "border-neutral-200 text-neutral-600 hover:bg-neutral-100",
      )}
    >
      {label}
    </button>
  );
}

function ProductTile({
  product,
  qty,
  onAdd,
  onRemove,
}: {
  product: ProductRow;
  qty: number;
  onAdd: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={cn(
        "card p-3 relative select-none transition-colors",
        qty > 0 && "border-brand bg-brand-soft",
      )}
    >
      {/* Whole tile adds one — the fastest possible tap target. */}
      <button
        className="w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand rounded-lg"
        onClick={onAdd}
        aria-label={`Add one ${product.name}`}
      >
        <div className="font-semibold leading-snug line-clamp-2 pr-8">{product.name}</div>
        <div className="text-sm text-neutral-500 mt-1 tabular-nums">
          {formatCurrency(product.price)}
          <span className="text-neutral-400"> / {product.unit}</span>
        </div>
      </button>
      {qty > 0 ? (
        <>
          <span className="absolute top-2 right-2 min-w-6 h-6 px-1.5 rounded-full bg-brand text-white text-sm font-bold grid place-items-center tabular-nums">
            {qty}
          </span>
          <button
            className="absolute bottom-2 right-2 w-8 h-8 rounded-full border border-neutral-300 text-lg leading-none grid place-items-center hover:bg-neutral-100"
            onClick={onRemove}
            aria-label={`Remove one ${product.name}`}
          >
            −
          </button>
        </>
      ) : null}
    </div>
  );
}
