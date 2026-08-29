/**
 * Public order success page — Plan §4.4.
 *
 * URL: /order/:slug/success/:orderNumber
 *
 * File name uses the `$slug_` non-nesting convention: the receipt REPLACES
 * the menu page rather than rendering inside it (the audit found the nested
 * variant unreachable because the menu route rendered no <Outlet/>).
 *
 * Fetches the receipt via the `public_order_lookup(slug, order_number)` RPC
 * (RLS forbids anon access to the `orders` table). No polling — the customer
 * refreshes manually if the status changes.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { publicMenuKeys, publicMenuRepo } from "@virundhu/client";
import { formatCurrencyExact } from "@/lib/format";
import { buildUpiIntentUrl } from "@/lib/upi";

export const Route = createFileRoute("/order/$slug_/success/$orderNumber")({
  component: OrderSuccessPage,
});

function OrderSuccessPage() {
  const { slug, orderNumber } = Route.useParams();
  const q = useQuery({
    queryKey: publicMenuKeys.order(slug, orderNumber),
    queryFn: () => publicMenuRepo.lookupOrder(slug, orderNumber),
    // Fresh forever from the client's perspective — the page is one-shot.
    // A manual reload re-fetches to pick up status changes (e.g. READY).
    staleTime: Infinity,
    gcTime: 5 * 60_000,
    retry: 1,
  });

  // Menu (usually already cached from checkout) supplies the store's VPA so
  // an interrupted UPI handoff can be retried from the receipt.
  const menu = useQuery({
    queryKey: publicMenuKeys.bySlug(slug),
    queryFn: () => publicMenuRepo.bySlug(slug),
    staleTime: 5 * 60_000,
  });

  if (q.isLoading) {
    return (
      <div className="min-h-full grid place-items-center p-6">
        <div className="text-sm text-neutral-500">Loading your order…</div>
      </div>
    );
  }
  if (q.error || !q.data) {
    return (
      <div className="min-h-full p-6 max-w-md mx-auto">
        <div className="card p-4 border-red-200 bg-red-50 text-red-700 text-sm">
          {(q.error as Error)?.message ?? "Order not found"}
        </div>
        <Link to="/order/$slug" params={{ slug }} className="btn btn-outline w-full mt-4">
          Back to menu
        </Link>
      </div>
    );
  }

  const r = q.data;
  const store = menu.data?.store;
  const upiRetry =
    r.paymentStatus === "PENDING" && store?.upiId
      ? buildUpiIntentUrl({
          vpa: store.upiId,
          payeeName: store.name,
          amount: r.total,
          orderNumber: r.orderNumber,
        })
      : null;

  return (
    <div className="min-h-full flex flex-col">
      <main className="flex-1 max-w-md mx-auto w-full p-4 pt-10 space-y-4">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center mx-auto mb-4 text-3xl">
            ✓
          </div>
          <h1 className="text-2xl font-extrabold">Order placed!</h1>
          <p className="text-sm text-neutral-500 mt-1">The kitchen has been notified.</p>
        </div>

        <div className="card p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-neutral-500">Order number</div>
              <div className="text-2xl font-extrabold tracking-wide tabular-nums">
                {r.orderNumber}
              </div>
            </div>
            <span className="badge bg-brand-soft text-brand">{r.status}</span>
          </div>

          <div className="rounded-xl border border-neutral-200 p-3.5">
            <div className="text-sm font-semibold mb-2">Items</div>
            {r.items.map((it, i) => (
              <div key={i} className="flex justify-between text-sm py-1">
                <span>
                  {it.quantity} × {it.name}
                </span>
                <span className="tabular-nums">{formatCurrencyExact(it.lineTotal)}</span>
              </div>
            ))}
          </div>

          <div className="space-y-1.5 text-sm">
            <Row label="Subtotal" value={formatCurrencyExact(r.subtotal)} />
            {r.tax > 0 ? <Row label="Tax" value={formatCurrencyExact(r.tax)} /> : null}
            <Row
              label={r.paymentStatus === "PAID" ? "Total paid" : "Total to pay"}
              value={formatCurrencyExact(r.total)}
              strong
            />
            <div className="text-xs text-neutral-400">
              {r.paymentStatus === "PAID" ? "Payment received" : "Pay at pickup"}
            </div>
          </div>

          {upiRetry ? (
            <a href={upiRetry} className="btn btn-primary w-full">
              Pay {formatCurrencyExact(r.total)} via UPI
            </a>
          ) : null}
        </div>

        <div className="rounded-xl bg-amber-100 text-amber-800 text-sm px-4 py-3">
          🕐 Please wait for your order to be prepared.
        </div>

        <Link to="/order/$slug" params={{ slug }} className="btn btn-outline w-full">
          Order more
        </Link>
      </main>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "font-bold text-base" : "text-neutral-600"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
