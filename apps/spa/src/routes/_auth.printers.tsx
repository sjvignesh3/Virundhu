import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { printerKeys, printersRepo } from "@virundhu/client";
import type { PrinterRow } from "@virundhu/shared";
import { useActiveStoreId } from "@/lib/useActiveStoreId";
import { PageHeader } from "@/components/PageHeader";
import { NoStoreState } from "@/components/NoStoreState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { cn } from "@/lib/cn";

export const Route = createFileRoute("/_auth/printers")({
  component: PrintersPage,
});

function PrintersPage() {
  const storeId = useActiveStoreId();
  if (!storeId) return <NoStoreState />;
  return <PrintersInner storeId={storeId} />;
}

function PrintersInner({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: printerKeys.list(storeId),
    queryFn: () => printersRepo.list(storeId),
  });

  const create = useMutation({
    mutationFn: (name: string) =>
      printersRepo.create(storeId, {
        name,
        type: "THERMAL",
        connection_status: "UNKNOWN",
        address: null,
        is_active: true,
        config: {},
      }),
    onSuccess: () => {
      toast.success("Printer added");
      qc.invalidateQueries({ queryKey: printerKeys.list(storeId) });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
  });

  const toggleActive = useMutation({
    mutationFn: (p: PrinterRow) => printersRepo.update(p.id, { is_active: !p.is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: printerKeys.list(storeId) }),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Update failed"),
  });

  const remove = useMutation({
    mutationFn: (p: PrinterRow) => printersRepo.remove(p.id),
    onSuccess: () => {
      toast.success("Printer removed");
      qc.invalidateQueries({ queryKey: printerKeys.list(storeId) });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Delete failed"),
  });

  const [name, setName] = useState("");
  const [deleting, setDeleting] = useState<PrinterRow | null>(null);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl">
      <PageHeader
        title="Printers"
        subtitle="Configure printers per station — kitchen KOTs and customer bills."
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          create.mutate(name.trim());
          setName("");
        }}
        className="card p-3 flex gap-2"
      >
        <label htmlFor="pr-name" className="sr-only">
          Printer name
        </label>
        <input
          id="pr-name"
          className="input flex-1"
          placeholder="Printer name (e.g. Kitchen KOT)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={create.isPending}>
          Add
        </button>
      </form>

      <div className="grid gap-3">
        {q.isLoading ? (
          <div className="text-sm text-neutral-500">Loading…</div>
        ) : q.error ? (
          <div className="card p-4 border-red-200 bg-red-50 text-red-700 text-sm">
            {(q.error as Error).message}
          </div>
        ) : (
          <>
            {q.data?.map((p) => (
              <div key={p.id} className="card p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    {p.type} · {p.connection_status} · {p.address ?? "no address"}
                  </div>
                </div>
                <span
                  className={cn(
                    "badge",
                    p.is_active
                      ? "bg-green-100 text-green-700"
                      : "bg-neutral-100 text-neutral-500",
                  )}
                >
                  {p.is_active ? "Active" : "Off"}
                </span>
                <button
                  className="btn btn-outline !px-3"
                  onClick={() => toggleActive.mutate(p)}
                  disabled={toggleActive.isPending}
                >
                  {p.is_active ? "Disable" : "Enable"}
                </button>
                <button
                  className="btn btn-outline !px-3"
                  aria-label={`Delete ${p.name}`}
                  onClick={() => setDeleting(p)}
                >
                  🗑
                </button>
              </div>
            ))}
            {q.data?.length === 0 ? (
              <div className="card p-8 text-center text-neutral-500 text-sm">
                No printers configured. Add one above to route KOTs.
              </div>
            ) : null}
          </>
        )}
      </div>

      {deleting ? (
        <ConfirmDialog
          title={`Remove printer “${deleting.name}”?`}
          body="Print jobs routed to it will stop. You can add it again later."
          confirmLabel="Remove printer"
          pending={remove.isPending}
          onConfirm={() => remove.mutate(deleting, { onSettled: () => setDeleting(null) })}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </div>
  );
}
