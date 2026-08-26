import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { orderKeys, ordersRepo } from "@virundhu/client";
import { useActiveStoreId } from "@/lib/useActiveStoreId";
import { PageHeader } from "@/components/PageHeader";
import { formatCurrency, formatDate, formatTime } from "@/lib/format";

export const Route = createFileRoute("/_auth/orders/history")({
  component: HistoryPage,
});

function HistoryPage() {
  const storeId = useActiveStoreId();
  if (!storeId) return <div className="p-6 text-sm text-neutral-500">Loading store…</div>;
  return <HistoryInner storeId={storeId} />;
}

function HistoryInner({ storeId }: { storeId: string }) {
  const [page, setPage] = useState(1);
  const filter = { page, limit: 20 };
  const q = useQuery({
    queryKey: orderKeys.list(storeId, filter),
    queryFn: () => ordersRepo.list(storeId, filter),
  });

  const totalPages = q.data ? Math.max(1, Math.ceil(q.data.total / q.data.limit)) : 1;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        title="Order history"
        subtitle={q.data ? `${q.data.total} orders` : "Loading…"}
      />

      {q.isLoading ? (
        <div className="text-sm text-neutral-500">Loading…</div>
      ) : q.error ? (
        <div className="card p-4 border-red-200 bg-red-50 text-red-700 text-sm">
          {(q.error as Error).message}
        </div>
      ) : (
        <>
          <div className="card divide-y">
            {q.data?.rows.map((o) => (
              <div key={o.id} className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">#{o.order_number}</div>
                  <div className="text-xs text-neutral-500 truncate">
                    {formatDate(o.created_at)} · {formatTime(o.created_at)}
                    {o.customer_name ? ` · ${o.customer_name}` : ""}
                  </div>
                </div>
                <div className="text-xs badge bg-neutral-100 text-neutral-700">
                  {o.status.toLowerCase()}
                </div>
                <div className="text-sm font-semibold tabular-nums">
                  {formatCurrency(o.total_amount)}
                </div>
              </div>
            ))}
            {q.data?.rows.length === 0 ? (
              <div className="p-6 text-center text-neutral-500 text-sm">No orders yet</div>
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
            <span className="text-sm text-neutral-500">
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
