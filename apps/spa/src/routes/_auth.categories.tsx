import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { categoryKeys, categoriesRepo } from "@virundhu/client";
import type { CategoryRow } from "@virundhu/shared";
import { useActiveStoreId } from "@/lib/useActiveStoreId";
import { PageHeader } from "@/components/PageHeader";
import { NoStoreState } from "@/components/NoStoreState";

export const Route = createFileRoute("/_auth/categories")({
  component: CategoriesPage,
});

function CategoriesPage() {
  const storeId = useActiveStoreId();
  if (!storeId) return <NoStoreState />;
  return <CategoriesInner storeId={storeId} />;
}

function CategoriesInner({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: categoryKeys.list(storeId),
    queryFn: () => categoriesRepo.list(storeId),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: categoryKeys.list(storeId) });

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
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
  });

  const rename = useMutation({
    mutationFn: (p: { id: string; name: string; tamil_name: string }) =>
      categoriesRepo.update(p.id, {
        name: p.name.trim(),
        tamil_name: p.tamil_name.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Category updated");
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Rename failed"),
  });

  const remove = useMutation({
    mutationFn: (c: CategoryRow) => categoriesRepo.remove(c.id),
    onSuccess: () => {
      toast.success("Category deleted");
      invalidate();
    },
    onError: (err) =>
      toast.error(
        err instanceof Error
          ? err.message
          : "Delete failed — move or delete its products first.",
      ),
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
    onSettled: invalidate,
  });

  const [name, setName] = useState("");
  const [tamil, setTamil] = useState("");
  const [editing, setEditing] = useState<CategoryRow | null>(null);

  function swap(idx: number, delta: -1 | 1) {
    const ids = (list.data ?? []).map((x) => x.id);
    const a = ids[idx];
    const b = ids[idx + delta];
    if (!a || !b) return;
    ids[idx] = b;
    ids[idx + delta] = a;
    reorder.mutate(ids);
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl">
      <PageHeader
        title="Categories"
        subtitle="Group your menu — customers see these as sections."
      />

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
        <label htmlFor="cat-name" className="sr-only">Category name</label>
        <input
          id="cat-name"
          className="input md:flex-1"
          placeholder="Category name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <label htmlFor="cat-tamil" className="sr-only">Tamil name</label>
        <input
          id="cat-tamil"
          className="input md:flex-1"
          placeholder="Tamil name (optional)"
          value={tamil}
          onChange={(e) => setTamil(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={create.isPending}>
          Add
        </button>
      </form>

      {list.isLoading ? (
        <div className="text-sm text-neutral-500">Loading…</div>
      ) : list.error ? (
        <div className="card p-4 border-red-200 bg-red-50 text-red-700 text-sm">
          {(list.error as Error).message}
        </div>
      ) : (
        <div className="grid gap-2.5">
          {list.data?.map((c, idx) => (
            <div key={c.id} className="card p-3.5 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{c.name}</div>
                {c.tamil_name ? (
                  <div className="text-xs text-neutral-500">{c.tamil_name}</div>
                ) : null}
              </div>
              <button
                className="btn btn-outline !px-2.5 text-xs"
                aria-label={`Move ${c.name} up`}
                disabled={idx === 0}
                onClick={() => swap(idx, -1)}
              >
                ↑
              </button>
              <button
                className="btn btn-outline !px-2.5 text-xs"
                aria-label={`Move ${c.name} down`}
                disabled={idx === (list.data?.length ?? 0) - 1}
                onClick={() => swap(idx, 1)}
              >
                ↓
              </button>
              <button
                className="btn btn-outline !px-2.5 text-xs"
                aria-label={`Rename ${c.name}`}
                onClick={() => setEditing(c)}
              >
                ✏️
              </button>
              <button
                className="btn btn-outline !px-2.5 text-xs"
                aria-label={`Delete ${c.name}`}
                onClick={() => {
                  if (window.confirm(`Delete category “${c.name}”? Products inside must be moved first.`)) {
                    remove.mutate(c);
                  }
                }}
              >
                🗑
              </button>
            </div>
          ))}
          {list.data?.length === 0 ? (
            <div className="card p-8 text-center text-neutral-500 text-sm">
              No categories yet — add your first section above.
            </div>
          ) : null}
        </div>
      )}

      {editing ? (
        <EditDialog
          category={editing}
          pending={rename.isPending}
          onSave={(nameV, tamilV) => {
            rename.mutate(
              { id: editing.id, name: nameV, tamil_name: tamilV },
              { onSuccess: () => setEditing(null) },
            );
          }}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function EditDialog({
  category,
  pending,
  onSave,
  onClose,
}: {
  category: CategoryRow;
  pending: boolean;
  onSave: (name: string, tamil: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(category.name);
  const [tamil, setTamil] = useState(category.tamil_name ?? "");
  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center p-4 z-50">
      <div className="card w-full max-w-sm p-6">
        <h2 className="font-bold text-lg mb-4">Rename category</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            onSave(name, tamil);
          }}
          className="space-y-3"
        >
          <div>
            <label htmlFor="ec-name" className="block text-sm font-medium mb-1">Name</label>
            <input
              id="ec-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="ec-tamil" className="block text-sm font-medium mb-1">
              Tamil name (optional)
            </label>
            <input
              id="ec-tamil"
              className="input"
              value={tamil}
              onChange={(e) => setTamil(e.target.value)}
            />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
