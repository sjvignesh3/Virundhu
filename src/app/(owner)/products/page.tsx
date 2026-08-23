"use client";

import * as React from "react";
import Link from "next/link";
import { FolderTree, Pencil, Plus, Search, Trash2, UtensilsCrossed } from "lucide-react";
import { PageHeader } from "@/components/owner/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useCollection, useRepos } from "@/lib/repositories/repo-provider";
import { useDemoStore } from "@/lib/hooks/use-demo-store";
import type { Product } from "@/lib/domain/types";
import { ProductForm } from "@/features/products/product-form";
import { formatCurrency } from "@/lib/utils";

const ALL_CATEGORIES = "__ALL__";

export default function ProductsPage() {
  const { store, loading: storeLoading } = useDemoStore();
  const repos = useRepos();

  const loadCategories = React.useCallback(
    async (r: import("@/lib/repositories").Repos) => {
      if (!store) return [];
      return r.categories.list(store.id);
    },
    [store],
  );
  const { data: categories } = useCollection("categories", loadCategories);

  const loadProducts = React.useCallback(
    async (r: import("@/lib/repositories").Repos) => {
      if (!store) return [];
      return r.products.list(store.id);
    },
    [store],
  );
  const { data: products, loading } = useCollection("products", loadProducts);

  const [search, setSearch] = React.useState("");
  const [filterCategory, setFilterCategory] = React.useState<string>(ALL_CATEGORIES);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Product | null>(null);
  const [deleting, setDeleting] = React.useState<Product | null>(null);

  const categoryList = React.useMemo(() => categories ?? [], [categories]);
  const categoryById = React.useMemo(
    () => new Map(categoryList.map((c) => [c.id, c])),
    [categoryList],
  );

  const filtered = React.useMemo(() => {
    const list = products ?? [];
    const q = search.trim().toLowerCase();
    return list.filter((p) => {
      if (filterCategory !== ALL_CATEGORIES && p.categoryId !== filterCategory) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.tamilName?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [products, search, filterCategory]);

  async function toggleAvailable(product: Product, next: boolean) {
    if (!repos) return;
    await repos.products.setAvailability(product.id, next);
  }

  async function handleDelete() {
    if (!repos || !deleting) return;
    await repos.products.remove(deleting.id);
  }

  const pageBusy = storeLoading || (loading && !products);
  const totalCount = products?.length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Menu items with prices, availability, and Tamil translations."
        actions={
          categoryList.length === 0 ? (
            <Button asChild variant="outline" title="Create a category before adding products">
              <Link href="/categories">
                <FolderTree className="h-4 w-4" />
                Create category first
              </Link>
            </Button>
          ) : (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              disabled={!store}
            >
              <Plus className="h-4 w-4" />
              New product
            </Button>
          )
        }
      />

      {totalCount > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products…"
              className="pl-9"
            />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CATEGORIES}>All categories</SelectItem>
              {categoryList.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {pageBusy ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Loading products…
          </CardContent>
        </Card>
      ) : totalCount === 0 ? (
        <EmptyState
          icon={<UtensilsCrossed className="h-6 w-6" />}
          title="No products yet"
          description={
            categoryList.length === 0
              ? "Create a category first, then add your first product."
              : "Add your first menu item to start taking orders."
          }
          action={
            categoryList.length > 0 && (
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                New product
              </Button>
            )
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No matches"
          description="Try a different search or filter."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const cat = categoryById.get(p.categoryId);
            return (
              <Card key={p.id} className="flex flex-col">
                <CardContent className="flex flex-1 flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold">{p.name}</h3>
                      {p.tamilName && (
                        <p className="truncate text-sm text-muted-foreground font-tamil">
                          {p.tamilName}
                        </p>
                      )}
                    </div>
                    <Badge variant={p.available ? "success" : "secondary"}>
                      {p.available ? "Available" : "Hidden"}
                    </Badge>
                  </div>

                  {p.description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {p.description}
                    </p>
                  )}

                  <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                    <div>
                      <p className="text-lg font-bold">{formatCurrency(p.price)}</p>
                      <p className="text-xs text-muted-foreground">
                        {cat?.name ?? "Uncategorized"} · per {p.unit}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Switch
                        checked={p.available}
                        onCheckedChange={(v) => toggleAvailable(p, v)}
                        aria-label={`Toggle availability for ${p.name}`}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing(p);
                          setFormOpen(true);
                        }}
                        aria-label={`Edit ${p.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleting(p)}
                        aria-label={`Delete ${p.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {store && (
        <ProductForm
          storeId={store.id}
          categories={categoryList}
          open={formOpen}
          onOpenChange={setFormOpen}
          product={editing}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete product?"
        description={
          deleting
            ? `"${deleting.name}" will be permanently removed from the menu. Existing orders are unaffected.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}
