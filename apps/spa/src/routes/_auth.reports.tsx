import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { reportsKeys, reportsRepo } from "@virundhu/client";
import { useActiveStoreId } from "@/lib/useActiveStoreId";
import { PageHeader } from "@/components/PageHeader";
import { formatCurrency, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_auth/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const storeId = useActiveStoreId();
  if (!storeId) return <div className="p-6 text-sm text-neutral-500">Loading store…</div>;
  return <ReportsInner storeId={storeId} />;
}

function ReportsInner({ storeId }: { storeId: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(weekAgo);
  const [to, setTo] = useState(today);

  const q = useQuery({
    queryKey: reportsKeys.sales(storeId, from, to),
    queryFn: () => reportsRepo.sales(storeId, from, to),
  });

  const totals = useMemo(() => {
    const rows = q.data ?? [];
    return {
      orders: rows.length,
      revenue: rows.reduce((s, r) => s + r.total_amount, 0),
      tax: rows.reduce((s, r) => s + r.tax_amount, 0),
    };
  }, [q.data]);

  function downloadCsv() {
    const rows = q.data ?? [];
    const header = "order_number,created_at,status,customer,items,subtotal,tax,total\n";
    const body = rows
      .map((r) =>
        [
          r.order_number,
          r.created_at,
          r.status,
          (r.customer_name ?? "").replace(/,/g, " "),
          r.items,
          (r.subtotal / 100).toFixed(2),
          (r.tax_amount / 100).toFixed(2),
          (r.total_amount / 100).toFixed(2),
        ].join(","),
      )
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        title="Sales report"
        subtitle={`${from} → ${to}`}
        actions={
          <button className="btn btn-outline" onClick={downloadCsv} disabled={!q.data?.length}>
            Download CSV
          </button>
        }
      />

      <div className="card p-3 flex flex-col md:flex-row gap-2">
        <input type="date" className="input md:flex-1" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className="input md:flex-1" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3">
          <div className="text-xs uppercase text-neutral-500">Orders</div>
          <div className="text-xl font-semibold">{totals.orders}</div>
        </div>
        <div className="card p-3">
          <div className="text-xs uppercase text-neutral-500">Revenue</div>
          <div className="text-xl font-semibold">{formatCurrency(totals.revenue)}</div>
        </div>
        <div className="card p-3">
          <div className="text-xs uppercase text-neutral-500">Tax</div>
          <div className="text-xl font-semibold">{formatCurrency(totals.tax)}</div>
        </div>
      </div>

      {q.isLoading ? (
        <div className="text-sm text-neutral-500">Loading…</div>
      ) : q.error ? (
        <div className="card p-4 border-red-200 bg-red-50 text-red-700 text-sm">
          {(q.error as Error).message}
        </div>
      ) : (
        <div className="card divide-y">
          {q.data?.map((r) => (
            <div key={r.order_number} className="p-3 flex items-center gap-3">
              <div className="text-sm font-medium">#{r.order_number}</div>
              <div className="text-xs text-neutral-500 flex-1 truncate">
                {formatDate(r.created_at)} · {r.customer_name ?? "walk-in"}
              </div>
              <div className="text-xs badge bg-neutral-100">{r.status.toLowerCase()}</div>
              <div className="text-sm font-semibold tabular-nums">
                {formatCurrency(r.total_amount)}
              </div>
            </div>
          ))}
          {q.data?.length === 0 ? (
            <div className="p-6 text-center text-neutral-500 text-sm">No orders in this range</div>
          ) : null}
        </div>
      )}
    </div>
  );
}
