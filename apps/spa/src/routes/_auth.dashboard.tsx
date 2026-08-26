import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { dashboardKeys, dashboardRepo } from "@virundhu/client";
import { useActiveStoreId } from "@/lib/useActiveStoreId";
import { PageHeader } from "@/components/PageHeader";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/_auth/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const storeId = useActiveStoreId();
  if (!storeId) return <div className="p-6 text-sm text-neutral-500">Loading store…</div>;
  return <DashboardInner storeId={storeId} />;
}

function DashboardInner({ storeId }: { storeId: string }) {
  const q = useQuery({
    queryKey: dashboardKeys.summary(storeId),
    queryFn: () => dashboardRepo.summary(storeId, "today"),
  });

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="Dashboard" subtitle="Today at a glance" />
      {q.isLoading ? (
        <SkeletonGrid />
      ) : q.error ? (
        <ErrorState message={(q.error as Error).message} />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Orders" value={q.data?.orderCount ?? 0} />
            <Stat label="Revenue" value={formatCurrency(q.data?.revenue ?? 0)} />
            <Stat label="Avg. order" value={formatCurrency(q.data?.avgOrderValue ?? 0)} />
            <Stat label="Range" value={q.data?.range ?? "today"} />
          </div>
          {q.data && q.data.topProducts.length > 0 ? (
            <div className="card p-4">
              <h2 className="text-sm font-semibold mb-3 text-neutral-700">Top products</h2>
              <div className="grid gap-2">
                {q.data.topProducts.slice(0, 5).map((p, i) => (
                  <div key={`${p.product_id ?? "row"}-${i}`} className="flex items-center gap-3">
                    <div className="text-xs text-neutral-400 w-4">{i + 1}</div>
                    <div className="flex-1 truncate text-sm">{p.name}</div>
                    <div className="text-xs text-neutral-500">×{p.qty}</div>
                    <div className="text-sm font-medium tabular-nums">
                      {formatCurrency(p.revenue)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="card p-4 animate-pulse">
          <div className="h-3 bg-neutral-200 rounded w-1/2" />
          <div className="h-6 bg-neutral-200 rounded w-3/4 mt-3" />
        </div>
      ))}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="card p-4 border-red-200 bg-red-50 text-red-700 text-sm">{message}</div>
  );
}
