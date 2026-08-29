import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { productKeys, productsRepo, categoryKeys, categoriesRepo } from "@virundhu/client";
import type { CategoryRow, ProductRow } from "@virundhu/shared";
import { UNITS } from "@virundhu/shared";
import { useActiveStoreId } from "@/lib/useActiveStoreId";
import { PageHeader } from "@/components/PageHeader";
import { NoStoreState } from "@/components/NoStoreState";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/cn";

export const Route = createFileRoute("/_auth/products")({
  component: ProductsPage,
});

function ProductsPage() {
  const storeId = useActiveStoreId();
  if (!storeId) return <NoStoreState />;
  return <ProductsInner storeId={storeId} />;
}

type FormState = {
  id: string | null; // null → create
  name: string;
  tamil_name: string;
  price: string;
  category_id: string;
  unit: string;
};

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

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("");

  const visible = useMemo(() => {
    let rows = products.data ?? [];
    if (catFilter) rows = rows.filter((p) => p.category_id === catFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.tamil_name ?? "").toLowerCase().includes(q),
      );
    }
    return rows;
  }, [products.data, catFilter, search]);

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

  const removeProduct = useMutation({
    mutationFn: (p: ProductRow) => productsRepo.remove(p.id),
    onSuccess: () => {
      toast.success("Product deleted");
      qc.invalidateQueries({ queryKey: productKeys.list(storeId) });
    },
    onError: (err) =>
      toast.error(
        err instanceof Error
          ? err.message
          : "Delete failed — products with past orders can be hidden instead.",
      ),
  });

  const [form, setForm] = useState<FormState | null>(null);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl">
      <PageHeader
        title="Products"
        subtitle="Menu items with prices, availability, and Tamil translations."
        actions={
          <button
            className="btn btn-primary"
            onClick={() =>
              setForm({
                id: null,
                name: "",
                tamil_name: "",
                price: "",
                category_id: categories.data?.[0]?.id ?? "",
                unit: "plate",
              })
            }
          >
            + New product
          </button>
        }
      />

      <div className="flex flex-col md:flex-row gap-2">
        <input
          className="input md:flex-1"
          placeholder="🔍 Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input md:w-56"
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
        >
          <option value="">All categories</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {products.isLoading ? (
        <div className="text-sm text-neutral-500">Loading…</div>
      ) : products.error ? (
        <div className="card p-4 border-red-200 bg-red-50 text-red-700 text-sm">
          {(products.error as Error).message}
        </div>
      ) : visible.length === 0 ? (
        <div className="card p-10 text-center text-neutral-500">
          {products.data?.length === 0
            ? "No products yet. Click “New product” to get started."
            : "Nothing matches your search."}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {visible.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              categories={categories.data ?? []}
              onToggle={() => toggleAvailable.mutate(p)}
              onEdit={() =>
                setForm({
                  id: p.id,
                  name: p.name,
                  tamil_name: p.tamil_name ?? "",
                  price: String(p.price),
                  category_id: p.category_id ?? "",
                  unit: p.unit,
                })
              }
              onDelete={() => {
                if (window.confirm(`Delete “${p.name}”? This cannot be undone.`)) {
                  removeProduct.mutate(p);
                }
              }}
            />
          ))}
        </div>
      )}

      {form ? (
        <ProductFormDialog
          storeId={storeId}
          form={form}
          categories={categories.data ?? []}
          onClose={() => setForm(null)}
        />
      ) : null}
    </div>
  );
}

function ProductCard({
  product,
  categories,
  onToggle,
  onEdit,
  onDelete,
}: {
  product: ProductRow;
  categories: CategoryRow[];
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const cat = categories.find((c) => c.id === product.category_id);
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="font-bold truncate">{product.name}</div>
        <span
          className={cn(
            "badge shrink-0",
            product.is_available
              ? "bg-green-100 text-green-700"
              : "bg-neutral-100 text-neutral-500",
          )}
        >
          {product.is_available ? "Available" : "Hidden"}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div>
          <div className="text-xl font-extrabold tabular-nums">
            {formatCurrency(product.price)}
          </div>
          <div className="text-xs text-neutral-500 mt-0.5">
            {cat?.name ?? "—"} · per {product.unit}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {/* availability switch */}
          <button
            role="switch"
            aria-checked={product.is_available}
            aria-label={`${product.name} availability`}
            onClick={onToggle}
            className={cn(
              "w-10 h-6 rounded-full p-0.5 transition-colors",
              product.is_available ? "bg-brand" : "bg-neutral-300",
            )}
          >
            <span
              className={cn(
                "block w-5 h-5 rounded-full bg-white shadow transition-transform",
                product.is_available && "translate-x-4",
              )}
            />
          </button>
          <button
            className="btn btn-outline !p-2"
            aria-label={`Edit ${product.name}`}
            onClick={onEdit}
          >
            ✏️
          </button>
          <button
            className="btn btn-outline !p-2"
            aria-label={`Delete ${product.name}`}
            onClick={onDelete}
          >
            🗑
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductFormDialog({
  storeId,
  form: initial,
  categories,
  onClose,
}: {
  storeId: string;
  form: FormState;
  categories: CategoryRow[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState(initial);
  const editing = form.id !== null;

  const save = useMutation({
    mutationFn: () => {
      // Price is RUPEES — stored verbatim as numeric(12,2). (The audit found
      // a ×100 paise conversion here that inflated every owner-created price.)
      const price = Math.round(parseFloat(form.price) * 100) / 100;
      const unit = form.unit as ProductRow["unit"];
      if (editing) {
        return productsRepo.update(form.id as string, {
          name: form.name.trim(),
          tamil_name: form.tamil_name.trim() || null,
          price,
          unit,
          category_id: form.category_id,
        });
      }
      return productsRepo.create(storeId, {
        category_id: form.category_id,
        name: form.name.trim(),
        tamil_name: form.tamil_name.trim() || null,
        description: null,
        tamil_description: null,
        image_url: null,
        stock_quantity: null,
        low_stock_threshold: null,
        display_order: 0,
        price,
        unit,
        is_available: true,
      });
    },
    onSuccess: () => {
      toast.success(editing ? "Product updated" : "Product added");
      qc.invalidateQueries({ queryKey: productKeys.list(storeId) });
      onClose();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
  });

  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center p-4 z-50">
      <div className="card w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-4">{editing ? "Edit product" : "New product"}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.category_id) {
              toast.error("Create a category first");
              return;
            }
            const price = parseFloat(form.price);
            if (!Number.isFinite(price) || price <= 0) {
              toast.error("Enter a price greater than ₹0");
              return;
            }
            save.mutate();
          }}
          className="space-y-3"
        >
          <Field id="pf-name" label="Name">
            <input
              id="pf-name"
              className="input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </Field>
          <Field id="pf-tamil" label="Tamil name (optional)">
            <input
              id="pf-tamil"
              className="input"
              value={form.tamil_name}
              onChange={(e) => setForm((f) => ({ ...f, tamil_name: e.target.value }))}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field id="pf-price" label="Price (₹)">
              <input
                id="pf-price"
                type="number"
                step="0.01"
                min="0"
                className="input"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                required
              />
            </Field>
            <Field id="pf-unit" label="Unit">
              <select
                id="pf-unit"
                className="input"
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field id="pf-cat" label="Category">
            <select
              id="pf-cat"
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
          </Field>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={save.isPending}>
              {save.isPending ? "Saving…" : editing ? "Save changes" : "Add product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
