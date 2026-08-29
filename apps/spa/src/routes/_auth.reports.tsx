import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  dashboardKeys,
  dashboardRepo,
  reportsKeys,
  reportsRepo,
} from "@virundhu/client";
import type { DashboardRange } from "@virundhu/client";
import { useActiveStoreId } from "@/lib/useActiveStoreId";
import { PageHeader } from "@/components/PageHeader";
import { NoStoreState } from "@/components/NoStoreState";
import { formatCurrency } from "@/lib/format";
import { IconRupee, IconBag, IconChart } from "@/components/icons";
import { cn } from "@/lib/cn";

export const Route = createFileRoute("/_auth/reports")({
  component: ReportsPage,
});

const RANGES: { key: DashboardRange; label: string; days: number | null }[] = [
  { key: "today", label: "Today", days: 0 },
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
  { key: "all", label: "All time", days: null },
];

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

function ReportsPage() {
  const storeId = useActiveStoreId();
  if (!storeId) return <NoStoreState />;
  return <ReportsInner storeId={storeId} />;
}

function ReportsInner({ storeId }: { storeId: string }) {
  const [range, setRange] = useState<DashboardRange>("today");

  const q = useQuery({
    queryKey: [...dashboardKeys.summary(storeId), range],
    queryFn: () => dashboardRepo.summary(storeId, range),
  });

  const rangeDef = RANGES.find((r) => r.key === range) ?? { key: "today" as const, label: "Today", days: 0 };
  const csvFrom = rangeDef.days === null ? "2000-01-01" : isoDaysAgo(rangeDef.days);
  const csvTo = isoDaysAgo(0);

  // Rows only fetched lazily for CSV export — the stat cards come from the
  // single dashboard_summary RPC.
  const rows = useQuery({
    queryKey: reportsKeys.sales(storeId, csvFrom, csvTo),
    queryFn: () => reportsRepo.sales(storeId, csvFrom, csvTo),
    enabled: false,
  });

  async function downloadCsv() {
    const res = await rows.refetch();
    const data = res.data ?? [];
    if (!data.length) {
      toast.info("No orders in this window to export.");
      return;
    }
    const header = "order_number,created_at,status,customer,items,subtotal,tax,total\n";
    const body = data
      .map((r) =>
        [
          r.order_number,
          r.created_at,
          r.status,
          `"${(r.customer_name ?? "").replace(/"/g, '""')}"`,
          r.items,
          // Money is rupees end-to-end — no /100 (audit fix).
          r.subtotal.toFixed(2),
          r.tax_amount.toFixed(2),
          r.total_amount.toFixed(2),
        ].join(","),
      )
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales_${range}_${csvTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const s = q.data;
  const cancelRate =
    s && s.orderCount > 0 ? Math.round((s.cancelledCount / s.orderCount) * 100) : 0;
  const topMax = Math.max(1, ...(s?.topProducts.map((p) => p.qty) ?? [1]));

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl">
      <PageHeader
        title="Reports"
        subtitle="Revenue, orders, and best-sellers over your chosen window."
        actions={
          <>
            <div className="flex rounded-xl border border-neutral-200 overflow-hidden">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  className={cn(
                    "px-3.5 py-2 text-sm font-semibold transition-colors",
                    range === r.key
                      ? "bg-brand text-white"
                      : "text-neutral-500 hover:bg-neutral-100",
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button className="btn btn-outline" onClick={downloadCsv} disabled={rows.isFetching}>
              ⬇ {rows.isFetching ? "Exporting…" : "Export CSV"}
            </button>
          </>
        }
      />

      {q.isLoading ? (
        <div className="text-sm text-neutral-500">Loading…</div>
      ) : q.error ? (
        <div className="card p-4 border-red-200 bg-red-50 text-red-700 text-sm">
          {(q.error as Error).message}
        </div>
      ) : s ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat icon={<IconRupee />} label="Revenue" value={formatCurrency(s.revenue)} />
            <Stat icon={<IconBag />} label="Completed Orders" value={s.completedCount} />
            <Stat
              icon={<IconChart />}
              label="Avg Ticket"
              value={formatCurrency(s.avgOrderValue)}
            />
            <Stat
              icon={<IconChart />}
              label="Cancel Rate"
              value={`${cancelRate}%`}
              hint={`${s.cancelledCount} cancelled`}
            />
          </div>

          <div className="card p-5">
            <h2 className="font-bold">Top Items</h2>
            <p className="text-sm text-neutral-500 mb-4">
              Sorted by quantity sold in this window.
            </p>
            {s.topProducts.length === 0 ? (
              <p className="text-sm text-neutral-500">No completed orders in this window.</p>
            ) : (
              <div className="space-y-4">
                {s.topProducts.map((p, i) => (
                  <div key={`${p.product_id ?? "row"}-${i}`}>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="w-6 h-6 rounded-md bg-neutral-100 text-neutral-500 text-xs grid place-items-center font-bold">
                        {i + 1}
                      </span>
                      <span className="font-semibold flex-1 truncate">{p.name}</span>
                      <span className="text-neutral-500">
                        {p.qty} sold · {formatCurrency(p.revenue)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                      <div
                        className="h-full bg-brand rounded-full"
                        style={{ width: `${Math.max(6, (p.qty / topMax) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="card p-4">
      <div className="stat-icon mb-3">{icon}</div>
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-2xl font-extrabold mt-0.5 tabular-nums">{value}</div>
      {hint ? <div className="text-xs text-neutral-400 mt-0.5">{hint}</div> : null}
    </div>
  );
}
