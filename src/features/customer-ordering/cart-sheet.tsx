"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/utils";
import type { Product, Store } from "@/lib/domain/types";
import { computeOrderTotals } from "@/lib/domain/totals";
import { useRepos } from "@/lib/repositories/repo-provider";
import { paymentService } from "@/lib/services/payment-service";
import type { UseCartResult } from "@/lib/hooks/use-cart";

interface CartSheetProps {
  store: Store;
  products: Product[];
  cart: UseCartResult;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CartSheet({
  store,
  products,
  cart,
  open,
  onOpenChange,
}: CartSheetProps) {
  const repos = useRepos();
  const router = useRouter();

  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [placing, setPlacing] = React.useState(false);

  const byId = React.useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  // Filter cart lines to those with a resolvable, available product.
  const visibleLines = cart.lines.filter((l) => {
    const p = byId.get(l.productId);
    return p && p.available;
  });

  const orderItems = cart.toOrderItems(products);
  const { subtotal, total } = computeOrderTotals(orderItems);

  const minOrder = store.minOrderValue ?? 0;
  const belowMin = minOrder > 0 && subtotal < minOrder;
  const empty = visibleLines.length === 0;

  async function handlePlace() {
    if (!repos) return;
    if (empty) return;
    if (belowMin) {
      setError(`Minimum order is ${formatCurrency(minOrder)}.`);
      return;
    }
    setPlacing(true);
    setError(null);
    try {
      const payment = await paymentService.charge(total);
      const order = await repos.orders.create({
        storeId: store.id,
        customer: {
          name: name.trim() || undefined,
          phone: phone.trim() || undefined,
          note: note.trim() || undefined,
        },
        items: orderItems,
        subtotal,
        total,
        paymentMethod: payment.method,
        paymentStatus: payment.status,
        status: "NEW",
      });
      cart.clear();
      onOpenChange(false);
      router.push(`/order/${store.slug}/success/${order.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPlacing(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Your order</SheetTitle>
          <SheetDescription>
            {empty
              ? "Your cart is empty."
              : `${cart.itemCount} item${cart.itemCount === 1 ? "" : "s"} from ${store.name}.`}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {empty ? (
            <EmptyState
              icon={<ShoppingBag className="h-6 w-6" />}
              title="Nothing here yet"
              description="Add some items from the menu."
            />
          ) : (
            <div className="space-y-4">
              <ul className="space-y-3">
                {visibleLines.map((line) => {
                  const p = byId.get(line.productId)!;
                  return (
                    <li
                      key={p.id}
                      className="flex items-start gap-3 rounded-md border p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{p.name}</p>
                        {p.tamilName && store.showTamilNames && (
                          <p className="truncate text-xs text-muted-foreground font-tamil">
                            {p.tamilName}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatCurrency(p.price)} · per {p.unit}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <p className="text-sm font-semibold tabular-nums">
                          {formatCurrency(p.price * line.quantity)}
                        </p>
                        <div className="flex items-center gap-1 rounded-md border">
                          <button
                            type="button"
                            className="p-1 hover:bg-accent"
                            onClick={() => cart.remove(p.id)}
                            aria-label={`Remove one ${p.name}`}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="min-w-[1.25rem] text-center text-xs tabular-nums">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            className="p-1 hover:bg-accent"
                            onClick={() => cart.add(p.id)}
                            aria-label={`Add one more ${p.name}`}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:text-destructive"
                          onClick={() => cart.setQuantity(p.id, 0)}
                          aria-label={`Remove ${p.name} from cart`}
                        >
                          <Trash2 className="inline h-3 w-3" /> Remove
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="grid gap-3 rounded-md border p-3">
                <div className="grid gap-2">
                  <Label htmlFor="c-name">Name (optional)</Label>
                  <Input
                    id="c-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ravi"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="c-phone">Phone (optional)</Label>
                  <Input
                    id="c-phone"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 90000 00000"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="c-note">Note (optional)</Label>
                  <Textarea
                    id="c-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Less spicy"
                    rows={2}
                  />
                </div>
              </div>

              <div className="space-y-1 rounded-md bg-muted/50 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-base font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">{formatCurrency(total)}</span>
                </div>
              </div>

              {belowMin && (
                <p className="text-sm text-destructive">
                  Minimum order is {formatCurrency(minOrder)}.
                </p>
              )}
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
            </div>
          )}
        </div>

        <SheetFooter>
          <Button
            className="w-full"
            size="lg"
            disabled={empty || placing || belowMin || store.status !== "OPEN"}
            onClick={handlePlace}
          >
            {placing
              ? "Placing order…"
              : store.status !== "OPEN"
                ? "Store closed"
                : `Pay ${formatCurrency(total)} · Simulated`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
