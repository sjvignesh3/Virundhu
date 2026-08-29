import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { storeKeys, storesRepo } from "@virundhu/client";
import { useActiveStoreId } from "@/lib/useActiveStoreId";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/_auth/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const storeId = useActiveStoreId();
  if (!storeId) return <div className="p-6 text-sm text-neutral-500">Loading store…</div>;
  return <SettingsInner storeId={storeId} />;
}

function SettingsInner({ storeId }: { storeId: string }) {
  const q = useQuery({
    queryKey: storeKeys.detail(storeId),
    queryFn: () => storesRepo.get(storeId),
  });

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="Settings" subtitle="Store profile" />

      {q.isLoading ? (
        <div className="text-sm text-neutral-500">Loading…</div>
      ) : q.error ? (
        <div className="card p-4 border-red-200 bg-red-50 text-red-700 text-sm">
          {(q.error as Error).message}
        </div>
      ) : (
        <div className="card p-4 space-y-2 text-sm">
          <Row label="Name" value={q.data?.name ?? "—"} />
          <Row label="Slug" value={q.data?.slug ?? "—"} />
          <Row label="Currency" value={q.data?.currency ?? "INR"} />
          <Row label="Tax rate" value={String(q.data?.tax_rate ?? "0")} />
          <Row
            label="UPI ID"
            value={q.data?.upi_id ?? "Not set — customers pay cash only"}
          />
          <p className="text-xs text-neutral-500 pt-2">
            UPI ID is set at signup. Editing UI lands next — email support to
            update in the meantime.
          </p>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <div className="text-neutral-500">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
