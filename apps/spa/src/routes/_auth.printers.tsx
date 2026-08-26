import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { printerKeys, printersRepo } from "@virundhu/client";
import { useActiveStoreId } from "@/lib/useActiveStoreId";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/_auth/printers")({
  component: PrintersPage,
});

function PrintersPage() {
  const storeId = useActiveStoreId();
  if (!storeId) return <div className="p-6 text-sm text-neutral-500">Loading store…</div>;
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

  const [name, setName] = useState("");

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="Printers" subtitle={`${q.data?.length ?? 0} configured`} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          create.mutate(name.trim());
          setName("");
        }}
        className="card p-3 flex gap-2"
      >
        <input
          className="input flex-1"
          placeholder="Printer name (e.g. Kitchen KOT)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={create.isPending}>
          Add
        </button>
      </form>

      <div className="grid gap-2">
        {q.data?.map((p) => (
          <div key={p.id} className="card p-3">
            <div className="font-medium">{p.name}</div>
            <div className="text-xs text-neutral-500">
              {p.type} · {p.connection_status} · {p.address ?? "no address"}
            </div>
          </div>
        ))}
        {q.data?.length === 0 ? (
          <div className="card p-6 text-center text-neutral-500 text-sm">
            No printers configured. Add one above to route KOTs.
          </div>
        ) : null}
      </div>
    </div>
  );
}
