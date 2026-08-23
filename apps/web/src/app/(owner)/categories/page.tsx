"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, FolderTree, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/owner/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useCollection, useRepos } from "@/lib/repositories/repo-provider";
import { useDemoStore } from "@/lib/hooks/use-demo-store";
import type { Category } from "@/lib/domain/types";
import { CategoryForm } from "@/features/categories/category-form";

export default function CategoriesPage() {
  const { store, loading: storeLoading } = useDemoStore();
  const repos = useRepos();

  const loader = React.useCallback(
    async (r: import("@/lib/repositories").Repos) => {
      if (!store) return [];
      return r.categories.list(store.id);
    },
    [store],
  );
  const { data: categories, loading } = useCollection("categories", loader);

  const loadProducts = React.useCallback(
    async (r: import("@/lib/repositories").Repos) => {
      if (!store) return [];
      return r.products.list(store.id);
    },
    [store],
  );
  const { data: products } = useCollection("products", loadProducts);

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Category | null>(null);
  const [deleting, setDeleting] = React.useState<Category | null>(null);

  const list = categories ?? [];
  const productCountByCategory = React.useMemo(() => {
    const map = new Map<string, number>();
    (products ?? []).forEach((p) => {
      map.set(p.categoryId, (map.get(p.categoryId) ?? 0) + 1);
    });
    return map;
  }, [products]);

  const nextSortOrder = list.length === 0 ? 0 : Math.max(...list.map((c) => c.sortOrder)) + 1;

  async function move(cat: Category, direction: -1 | 1) {
    if (!repos || !store) return;
    const sorted = [...list];
    const idx = sorted.findIndex((c) => c.id === cat.id);
    const swapIdx = idx + direction;
    if (idx === -1 || swapIdx < 0 || swapIdx >= sorted.length) return;
    [sorted[idx], sorted[swapIdx]] = [sorted[swapIdx], sorted[idx]];
    await repos.categories.reorder(
      store.id,
      sorted.map((c) => c.id),
    );
  }

  async function handleDelete() {
    if (!repos || !deleting) return;
    const count = productCountByCategory.get(deleting.id) ?? 0;
    if (count > 0) {
      // Guard handled in confirm dialog copy; still refuse.
      return;
    }
    await repos.categories.remove(deleting.id);
  }

  const pageBusy = storeLoading || (loading && !categories);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        description="Group products for easier browsing on the customer menu."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            disabled={!store}
          >
            <Plus className="h-4 w-4" />
            New category
          </Button>
        }
      />

      {pageBusy ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Loading categories…
          </CardContent>
        </Card>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<FolderTree className="h-6 w-6" />}
          title="No categories yet"
          description="Create your first category to start organizing products."
          action={
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              New category
            </Button>
          }
        />
      ) : (
        <Card>
          <ul className="divide-y">
            {list.map((cat, idx) => {
              const productCount = productCountByCategory.get(cat.id) ?? 0;
              return (
                <li
                  key={cat.id}
                  className="flex items-center gap-3 px-4 py-3 sm:px-6"
                >
                  <div className="flex flex-col">
                    <button
                      type="button"
                      className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
                      disabled={idx === 0}
                      onClick={() => move(cat, -1)}
                      aria-label={`Move ${cat.name} up`}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
                      disabled={idx === list.length - 1}
                      onClick={() => move(cat, 1)}
                      aria-label={`Move ${cat.name} down`}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{cat.name}</p>
                    {cat.tamilName && (
                      <p className="text-sm text-muted-foreground font-tamil truncate">
                        {cat.tamilName}
                      </p>
                    )}
                  </div>
                  <div className="hidden sm:block text-sm text-muted-foreground">
                    {productCount} product{productCount === 1 ? "" : "s"}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditing(cat);
                        setFormOpen(true);
                      }}
                      aria-label={`Edit ${cat.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleting(cat)}
                      aria-label={`Delete ${cat.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {store && (
        <CategoryForm
          storeId={store.id}
          open={formOpen}
          onOpenChange={setFormOpen}
          category={editing}
          nextSortOrder={nextSortOrder}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={
          deleting && (productCountByCategory.get(deleting.id) ?? 0) > 0
            ? "Cannot delete category"
            : "Delete category?"
        }
        description={
          deleting
            ? (productCountByCategory.get(deleting.id) ?? 0) > 0
              ? `"${deleting.name}" still has ${productCountByCategory.get(deleting.id)} product(s). Move or delete those products first.`
              : `"${deleting.name}" will be permanently removed. This action cannot be undone.`
            : undefined
        }
        confirmLabel={
          deleting && (productCountByCategory.get(deleting.id) ?? 0) > 0
            ? "Got it"
            : "Delete"
        }
        destructive={
          !!deleting && (productCountByCategory.get(deleting.id) ?? 0) === 0
        }
        onConfirm={handleDelete}
      />
    </div>
  );
}
