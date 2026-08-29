import { createFileRoute } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";
import { orderKeys, ordersRepo } from "@virundhu/client";
import { useActiveStoreId } from "@/lib/useActiveStoreId";
import { PageHeader } from "@/components/PageHeader";
import { NoStoreState } from "@/components/NoStoreState";
import { formatCurrency, formatDate, formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";

export const Route = createFileRoute("/_auth/orders/history")({
  component: HistoryPage,
});

function HistoryPage() {
  const storeId = useActiveStoreId();
  if (!storeId) return <NoStoreState />;
  return <HistoryInner storeId={storeId} />;
}

const STATUS_PILL: Record<string, string> = {
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-50 text-red-700",
};

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

function HistoryInner({ storeId }: { storeId: string }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  // Default window: last 7 days (Plan §3.3 line 6).
  const [from, setFrom] = useState(isoDaysAgo(7));
  const [to, setTo] = useState(isoDaysAgo(0));

  const filter = {
    page,
    limit: 20,
    search: search.trim() || undefined,
    from: from ? `${from}T00:00:00Z` : undefined,
    to: to ? `${to}T23:59:59Z` : undefined,
  };
  const q = useQuery({
    queryKey: orderKeys.list(storeId, filter),
    queryFn: () => ordersRepo.list(storeId, filter),
    placeholderData: keepPreviousData,
  });

  const totalPages = q.data ? Math.max(1, Math.ceil(q.data.total / q.data.limit)) : 1;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl">
      <PageHeader
        title="Order History"
        subtitle={q.data ? `${q.data.total} orders in this window` : "Loading…"}
      />

      <div className="flex flex-col md:flex-row gap-2">
        <input
          className="input md:flex-1"
          placeholder="🔍 Order number, customer name or phone…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <input
          type="date"
          aria-label="From date"
          className="input md:w-44"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setPage(1);
          }}
        />
        <input
          type="date"
          aria-label="To date"
          className="input md:w-44"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {q.isLoading ? (
        <div className="text-sm text-neutral-500">Loading…</div>
      ) : q.error ? (
        <div className="card p-4 border-red-200 bg-red-50 text-red-700 text-sm">
          {(q.error as Error).message}
        </div>
      ) : (
        <>
          <div className="card divide-y divide-neutral-200">
            {q.data?.rows.map((o) => (
              <div key={o.id} className="p-3.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold tabular-nums">#{o.order_number}</div>
                  <div className="text-xs text-neutral-500 truncate">
                    {formatDate(o.created_at)} · {formatTime(o.created_at)}
                    {o.customer_name ? ` · ${o.customer_name}` : ""}
                  </div>
                </div>
                <span
                  className={cn(
                    "badge",
                    STATUS_PILL[o.status] ?? "bg-neutral-100 text-neutral-600",
                  )}
                >
                  {o.status.toLowerCase()}
                </span>
                <div className="text-sm font-bold tabular-nums w-20 text-right">
                  {formatCurrency(o.total_amount)}
                </div>
              </div>
            ))}
            {q.data?.rows.length === 0 ? (
              <div className="p-8 text-center text-neutral-500 text-sm">
                No orders in this window
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2 justify-center">
            <button
              className="btn btn-outline text-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span className="text-sm text-neutral-500 tabular-nums">
              Page {page} / {totalPages}
            </span>
            <button
              className="btn btn-outline text-sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
