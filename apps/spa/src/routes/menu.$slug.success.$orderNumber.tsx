/**
 * Public order success page — Plan §4.4.
 *
 * URL: /menu/:slug/success/:orderNumber
 *
 * Rendered immediately after `orders_create` succeeds. Fetches the receipt
 * shape via the `public_order_lookup(slug, order_number)` RPC (RLS forbids
 * anon access to the `orders` table). No polling — the customer refreshes
 * manually if the status changes.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { publicMenuKeys, publicMenuRepo } from "@virundhu/client";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/menu/$slug/success/$orderNumber")({
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

  return (
    <div className="min-h-full bg-neutral-50 flex flex-col">
      <main className="flex-1 max-w-md mx-auto w-full p-4 space-y-4">
        <div className="card p-5 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center mx-auto mb-3 text-2xl">
            ✓
          </div>
          <h1 className="text-xl font-semibold">Order placed</h1>
          <div className="mt-1 text-sm text-neutral-600">
            Show this to the counter for pickup.
          </div>
          <div className="mt-4 text-2xl font-bold tabular-nums tracking-wider">
            #{orderNumber}
          </div>
        </div>

        {q.isLoading ? (
          <div className="card p-4 text-neutral-500 text-sm">Fetching receipt…</div>
        ) : q.error || !q.data ? (
          <div className="card p-4 border-red-200 bg-red-50 text-red-700 text-sm">
            {(q.error as Error)?.message ?? "Receipt not available"}
          </div>
        ) : (
          <>
            <div className="card p-4">
              <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Status</div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{q.data.status}</span>
                <span className="text-neutral-500">Payment: {q.data.paymentStatus}</span>
              </div>
            </div>

            <div className="card p-4">
              <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Items</div>
              <div className="divide-y">
                {q.data.items.map((it, idx) => (
                  <div key={idx} className="py-2 flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium">{it.name}</div>
                      <div className="text-xs text-neutral-500">× {it.quantity}</div>
                    </div>
                    <div className="font-semibold tabular-nums">
                      {formatCurrency(it.lineTotal)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t space-y-1 text-sm">
                <Row label="Subtotal" value={formatCurrency(q.data.subtotal)} />
                {q.data.tax > 0 ? <Row label="Tax" value={formatCurrency(q.data.tax)} /> : null}
                <Row label="Total" value={formatCurrency(q.data.total)} strong />
              </div>
            </div>
          </>
        )}

        <Link
          to="/menu/$slug"
          params={{ slug }}
          className="btn btn-outline w-full text-center"
        >
          Back to menu
        </Link>
      </main>
    </div>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={"flex items-center justify-between " + (strong ? "font-semibold" : "")}>
      <span className="text-neutral-600">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
