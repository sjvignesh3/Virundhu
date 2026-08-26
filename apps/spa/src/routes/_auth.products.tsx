import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { productKeys, productsRepo, categoryKeys, categoriesRepo } from "@virundhu/client";
import type { CategoryRow, ProductRow } from "@virundhu/shared";
import { useActiveStoreId } from "@/lib/useActiveStoreId";
import { PageHeader } from "@/components/PageHeader";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/_auth/products")({
  component: ProductsPage,
});

function ProductsPage() {
  const storeId = useActiveStoreId();
  if (!storeId) return <div className="p-6 text-sm text-neutral-500">Loading store…</div>;
  return <ProductsInner storeId={storeId} />;
}

function ProductsInner({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const products = useQuery({
    queryKey: productKeys.list(storeId),
    queryFn: () => productsRepo.list(storeId),
  });
  const categories = useQuery({
    queryKey: categoryKeys.list(storeId),
    queryFn: () => categoriesRepo.list(storeId),
  });

  const toggleAvailable = useMutation({
    mutationFn: (p: ProductRow) =>
      productsRepo.update(p.id, { is_available: !p.is_available }),
    onMutate: async (p) => {
      await qc.cancelQueries({ queryKey: productKeys.list(storeId) });
      const prev = qc.getQueryData<ProductRow[]>(productKeys.list(storeId));
      qc.setQueryData<ProductRow[]>(productKeys.list(storeId), (curr) =>
        (curr ?? []).map((row) =>
          row.id === p.id ? { ...row, is_available: !row.is_available } : row,
        ),
      );
      return { prev };
    },
    onError: (err, _p, ctx) => {
      if (ctx?.prev) qc.setQueryData(productKeys.list(storeId), ctx.prev);
      toast.error(err instanceof Error ? err.message : "Update failed");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: productKeys.list(storeId) }),
  });

  const [showForm, setShowForm] = useState(false);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        title="Products"
        subtitle={`${products.data?.length ?? 0} items`}
        actions={
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + Add product
          </button>
        }
      />

      {products.isLoading ? (
        <div className="text-sm text-neutral-500">Loading…</div>
      ) : products.error ? (
        <div className="card p-4 border-red-200 bg-red-50 text-red-700 text-sm">
          {(products.error as Error).message}
        </div>
      ) : products.data?.length === 0 ? (
        <div className="card p-8 text-center text-neutral-500">
          No products yet. Click "Add product" to get started.
        </div>
      ) : (
        <div className="grid gap-2">
          {products.data?.map((p) => (
            <ProductRowView
              key={p.id}
              product={p}
              categories={categories.data ?? []}
              onToggle={() => toggleAvailable.mutate(p)}
            />
          ))}
        </div>
      )}

      {showForm ? (
        <ProductFormDialog
          storeId={storeId}
          categories={categories.data ?? []}
          onClose={() => setShowForm(false)}
        />
      ) : null}
    </div>
  );
}

function ProductRowView({
  product,
  categories,
  onToggle,
}: {
  product: ProductRow;
  categories: CategoryRow[];
  onToggle: () => void;
}) {
  const cat = categories.find((c) => c.id === product.category_id);
  return (
    <div className="card p-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{product.name}</div>
        <div className="text-xs text-neutral-500 truncate">
          {cat?.name ?? "—"} · {formatCurrency(product.price)}
        </div>
      </div>
      <button
        onClick={onToggle}
        className={`badge ${product.is_available ? "bg-green-100 text-green-700" : "bg-neutral-200 text-neutral-600"}`}
      >
        {product.is_available ? "Available" : "Hidden"}
      </button>
    </div>
  );
}

function ProductFormDialog({
  storeId,
  categories,
  onClose,
}: {
  storeId: string;
  categories: CategoryRow[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    tamil_name: "",
    price: "",
    category_id: categories[0]?.id ?? "",
    unit: "plate",
  });

  const create = useMutation({
    mutationFn: () =>
      productsRepo.create(storeId, {
        category_id: form.category_id,
        name: form.name.trim(),
        tamil_name: form.tamil_name.trim() || null,
        description: null,
        tamil_description: null,
        image_url: null,
        stock_quantity: null,
        low_stock_threshold: null,
        display_order: 0,
        price: Math.round(parseFloat(form.price) * 100),
        unit: form.unit as "plate" | "piece" | "cup" | "glass" | "bottle" | "kg" | "g",
        is_available: true,
      }),
    onSuccess: () => {
      toast.success("Product added");
      qc.invalidateQueries({ queryKey: productKeys.list(storeId) });
      onClose();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
  });

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center p-4 z-50">
      <div className="card w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-3">New product</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.category_id) {
              toast.error("Create a category first");
              return;
            }
            create.mutate();
          }}
          className="space-y-3"
        >
          <div>
            <label className="block text-sm mb-1">Name</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Tamil name (optional)</label>
            <input
              className="input"
              value={form.tamil_name}
              onChange={(e) => setForm((f) => ({ ...f, tamil_name: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm mb-1">Price (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Unit</label>
              <input
                className="input"
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1">Category</label>
            <select
              className="input"
              value={form.category_id}
              onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
              required
            >
              {categories.length === 0 ? (
                <option value="">— create a category first —</option>
              ) : (
                categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={create.isPending}>
              {create.isPending ? "Adding…" : "Add product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
