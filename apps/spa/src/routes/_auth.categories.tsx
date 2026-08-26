import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { categoryKeys, categoriesRepo } from "@virundhu/client";
import type { CategoryRow } from "@virundhu/shared";
import { useActiveStoreId } from "@/lib/useActiveStoreId";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/_auth/categories")({
  component: CategoriesPage,
});

function CategoriesPage() {
  const storeId = useActiveStoreId();
  if (!storeId) return <div className="p-6 text-sm text-neutral-500">Loading store…</div>;
  return <CategoriesInner storeId={storeId} />;
}

function CategoriesInner({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: categoryKeys.list(storeId),
    queryFn: () => categoriesRepo.list(storeId),
  });

  const create = useMutation({
    mutationFn: (payload: { name: string; tamil_name: string }) =>
      categoriesRepo.create(storeId, {
        name: payload.name.trim(),
        tamil_name: payload.tamil_name.trim() || null,
        description: null,
        is_active: true,
        display_order: (list.data?.length ?? 0) + 1,
      }),
    onSuccess: () => {
      toast.success("Category added");
      qc.invalidateQueries({ queryKey: categoryKeys.list(storeId) });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
  });

  const reorder = useMutation({
    mutationFn: (orderedIds: string[]) => categoriesRepo.reorder(storeId, orderedIds),
    onMutate: async (orderedIds) => {
      await qc.cancelQueries({ queryKey: categoryKeys.list(storeId) });
      const prev = qc.getQueryData<CategoryRow[]>(categoryKeys.list(storeId));
      const map = new Map(prev?.map((c) => [c.id, c]) ?? []);
      qc.setQueryData<CategoryRow[]>(
        categoryKeys.list(storeId),
        orderedIds
          .map((id, i) => {
            const c = map.get(id);
            return c ? { ...c, display_order: i + 1 } : null;
          })
          .filter((v): v is CategoryRow => v !== null),
      );
      return { prev };
    },
    onError: (err, _, ctx) => {
      if (ctx?.prev) qc.setQueryData(categoryKeys.list(storeId), ctx.prev);
      toast.error(err instanceof Error ? err.message : "Reorder failed");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: categoryKeys.list(storeId) }),
  });

  const [name, setName] = useState("");
  const [tamil, setTamil] = useState("");

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="Categories" subtitle={`${list.data?.length ?? 0} categories`} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          create.mutate({ name, tamil_name: tamil });
          setName("");
          setTamil("");
        }}
        className="card p-3 flex flex-col md:flex-row gap-2"
      >
        <input className="input md:flex-1" placeholder="Category name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input md:flex-1" placeholder="Tamil name (optional)" value={tamil} onChange={(e) => setTamil(e.target.value)} />
        <button type="submit" className="btn btn-primary" disabled={create.isPending}>
          Add
        </button>
      </form>

      {list.isLoading ? (
        <div className="text-sm text-neutral-500">Loading…</div>
      ) : (
        <div className="grid gap-2">
          {list.data?.map((c, idx) => (
            <div key={c.id} className="card p-3 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-medium">{c.name}</div>
                {c.tamil_name ? <div className="text-xs text-neutral-500">{c.tamil_name}</div> : null}
              </div>
              <button
                className="btn btn-outline text-xs"
                disabled={idx === 0}
                onClick={() => {
                  const ids = (list.data ?? []).map((x) => x.id);
                  const a = ids[idx - 1];
                  const b = ids[idx];
                  if (!a || !b) return;
                  ids[idx - 1] = b;
                  ids[idx] = a;
                  reorder.mutate(ids);
                }}
              >
                ↑
              </button>
              <button
                className="btn btn-outline text-xs"
                disabled={idx === (list.data?.length ?? 0) - 1}
                onClick={() => {
                  const ids = (list.data ?? []).map((x) => x.id);
                  const a = ids[idx];
                  const b = ids[idx + 1];
                  if (!a || !b) return;
                  ids[idx] = b;
                  ids[idx + 1] = a;
                  reorder.mutate(ids);
                }}
              >
                ↓
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
