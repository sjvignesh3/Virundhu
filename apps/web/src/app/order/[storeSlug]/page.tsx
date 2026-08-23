"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { ShoppingBag, Store as StoreIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useCollection, useRepos } from "@/lib/repositories/repo-provider";
import type { Category, Product, Store } from "@/lib/domain/types";
import { formatCurrency, cn } from "@/lib/utils";
import { useCart } from "@/lib/hooks/use-cart";
import { ProductCard } from "@/features/customer-ordering/product-card";
import { CartSheet } from "@/features/customer-ordering/cart-sheet";

export default function CustomerOrderPage() {
  const params = useParams<{ storeSlug: string }>();
  const slug = params.storeSlug;
  const repos = useRepos();

  const loadStore = React.useCallback(
    async (r: import("@/lib/repositories").Repos) => r.stores.getBySlug(slug),
    [slug],
  );
  const { data: store, loading: storeLoading } = useCollection("stores", loadStore);

  const loadCategories = React.useCallback(
    async (r: import("@/lib/repositories").Repos) => {
      if (!store) return [] as Category[];
      return r.categories.list(store.id);
    },
    [store],
  );
  const { data: categories } = useCollection("categories", loadCategories);

  const loadProducts = React.useCallback(
    async (r: import("@/lib/repositories").Repos) => {
      if (!store) return [] as Product[];
      // Respect store.showUnavailable — but always fetch, filter at render for UX.
      return r.products.list(store.id);
    },
    [store],
  );
  const { data: products, loading: productsLoading } = useCollection("products", loadProducts);

  const cart = useCart(slug ?? null);
  const [cartOpen, setCartOpen] = React.useState(false);
  const [activeCategory, setActiveCategory] = React.useState<string | null>(null);

  if (!repos || storeLoading) {
    return null; // The route's loading.tsx already renders a skeleton.
  }

  if (!store) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <EmptyState
          icon={<StoreIcon className="h-6 w-6" />}
          title="Store not found"
          description={`No store exists at "${slug}".`}
        />
      </div>
    );
  }

  const catList = categories ?? [];
  const allProducts = products ?? [];
  const visibleProducts = store.showUnavailable
    ? allProducts
    : allProducts.filter((p) => p.available);

  const grouped: { category: Category; items: Product[] }[] = catList
    .map((c) => ({
      category: c,
      items: visibleProducts.filter((p) => p.categoryId === c.id),
    }))
    .filter((g) => g.items.length > 0);

  const quantityFor = (id: string) =>
    cart.lines.find((l) => l.productId === id)?.quantity ?? 0;

  const subtotal = cart.subtotal(allProducts);

  return (
    <div className="mx-auto max-w-3xl pb-32">
      {/* Hero */}
      <header className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent px-4 py-8 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {store.name}
            </h1>
            {store.tamilName && store.showTamilNames && (
              <p className="mt-1 text-lg text-muted-foreground font-tamil">
                {store.tamilName}
              </p>
            )}
            {store.description && (
              <p className="mt-2 text-sm text-muted-foreground">
                {store.description}
              </p>
            )}
          </div>
          <Badge variant={store.status === "OPEN" ? "success" : "secondary"}>
            {store.status === "OPEN" ? "Open" : "Closed"}
          </Badge>
        </div>
        {store.prepTimeMinutes && (
          <p className="mt-3 text-xs text-muted-foreground">
            Typical prep time: ~{store.prepTimeMinutes} min
          </p>
        )}
      </header>

      {/* Category chips */}
      {grouped.length > 0 && (
        <nav
          className="sticky top-0 z-20 flex gap-2 overflow-x-auto border-b bg-background/90 px-4 py-2 backdrop-blur sm:px-6"
          aria-label="Menu categories"
        >
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-sm transition-colors",
              activeCategory === null
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:bg-accent",
            )}
          >
            All
          </button>
          {grouped.map(({ category }) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setActiveCategory(category.id)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-sm transition-colors",
                activeCategory === category.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-accent",
              )}
            >
              {category.name}
            </button>
          ))}
        </nav>
      )}

      {/* Menu */}
      <main className="px-4 py-4 sm:px-6">
        {productsLoading && visibleProducts.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Loading menu…
          </p>
        ) : grouped.length === 0 ? (
          <EmptyState
            title="Menu coming soon"
            description="This store hasn't added any items yet."
          />
        ) : (
          <div className="space-y-8">
            {grouped
              .filter((g) => !activeCategory || g.category.id === activeCategory)
              .map(({ category, items }) => (
                <section key={category.id} aria-labelledby={`cat-${category.id}`}>
                  <div className="mb-3 flex items-baseline gap-2">
                    <h2
                      id={`cat-${category.id}`}
                      className="text-lg font-semibold"
                    >
                      {category.name}
                    </h2>
                    {category.tamilName && store.showTamilNames && (
                      <span className="text-sm text-muted-foreground font-tamil">
                        {category.tamilName}
                      </span>
                    )}
                  </div>
                  <div className="grid gap-3">
                    {items.map((p) => (
                      <ProductCard
                        key={p.id}
                        product={p}
                        quantity={quantityFor(p.id)}
                        showTamil={store.showTamilNames}
                        onAdd={() => cart.add(p.id)}
                        onRemove={() => cart.remove(p.id)}
                      />
                    ))}
                  </div>
                </section>
              ))}
          </div>
        )}
      </main>

      {/* Sticky cart bar */}
      {cart.itemCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-3 p-3 sm:p-4">
            <div className="flex-1">
              <p className="text-sm font-semibold">
                {cart.itemCount} item{cart.itemCount === 1 ? "" : "s"} ·{" "}
                <span className="tabular-nums">{formatCurrency(subtotal)}</span>
              </p>
              <p className="text-xs text-muted-foreground">Tap to review & pay</p>
            </div>
            <Button size="lg" onClick={() => setCartOpen(true)}>
              <ShoppingBag className="h-4 w-4" />
              View cart
            </Button>
          </div>
        </div>
      )}

      {store && (
        <CartSheet
          store={store as Store}
          products={allProducts}
          cart={cart}
          open={cartOpen}
          onOpenChange={setCartOpen}
        />
      )}
    </div>
  );
}
