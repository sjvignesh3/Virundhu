"use client";

import * as React from "react";
import { toast } from "sonner";
import { Ban, CheckCircle2, ChevronRight, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { OrderStatusBadge, orderStatusLabel } from "./order-status-badge";
import type { Order, OrderStatus } from "@/lib/domain/types";
import { nextValidStatuses } from "@/lib/domain/order-status";
import { useRepos } from "@/lib/repositories/repo-provider";
import { formatCurrency } from "@/lib/utils";
import { formatElapsed } from "./elapsed";

interface Props {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransitioned?: (order: Order) => void;
}

export function OrderDetailSheet({ order, open, onOpenChange, onTransitioned }: Props) {
  const repos = useRepos();
  const [busy, setBusy] = React.useState<OrderStatus | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setError(null);
      setBusy(null);
      setConfirmCancel(false);
    }
  }, [open]);

  if (!order) return null;

  const transitions = nextValidStatuses(order.status);
  const forward = transitions.filter((s) => s !== "CANCELLED");
  const canCancel = transitions.includes("CANCELLED");

  async function transition(next: OrderStatus) {
    if (!repos || !order) return;
    setBusy(next);
    setError(null);
    try {
      const updated = await repos.orders.transition(order.id, next);
      onTransitioned?.(updated);
      toast.success(
        next === "CANCELLED"
          ? `Order #${order.orderNumber} cancelled`
          : `Order #${order.orderNumber} marked ${orderStatusLabel(next).toLowerCase()}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transition failed.";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <div className="flex items-center justify-between gap-3">
              <SheetTitle className="tabular-nums">#{order.orderNumber}</SheetTitle>
              <OrderStatusBadge status={order.status} />
            </div>
            <SheetDescription>
              Placed {formatElapsed(order.createdAt)}
              {order.completedAt && ` · Completed ${formatElapsed(order.completedAt)}`}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {/* Customer */}
            {(order.customer.name || order.customer.phone || order.customer.note) && (
              <section className="space-y-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Customer
                </h3>
                {order.customer.name && (
                  <p className="text-sm font-medium">{order.customer.name}</p>
                )}
                {order.customer.phone && (
                  <p className="text-sm text-muted-foreground">{order.customer.phone}</p>
                )}
                {order.customer.note && (
                  <p className="mt-1 rounded-md bg-muted p-2 text-sm">
                    <span className="font-medium">Note:</span> {order.customer.note}
                  </p>
                )}
              </section>
            )}

            {/* Items */}
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Items
              </h3>
              <ul className="divide-y rounded-md border">
                {order.items.map((it) => (
                  <li key={it.productId} className="flex items-start gap-3 p-3">
                    <span className="min-w-[2rem] text-sm font-semibold tabular-nums">
                      {it.quantity}×
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{it.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(it.unitPrice)} · per {it.unit}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatCurrency(it.lineTotal)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Totals */}
            <section className="space-y-1 rounded-md bg-muted/50 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatCurrency(order.total)}</span>
              </div>
              <div className="flex justify-between pt-1 text-xs text-muted-foreground">
                <span>Payment</span>
                <span>
                  {order.paymentMethod} · {order.paymentStatus}
                </span>
              </div>
            </section>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>

          {(forward.length > 0 || canCancel) && (
            <SheetFooter className="flex flex-col gap-2">
              {forward.map((next) => (
                <Button
                  key={next}
                  className="w-full"
                  size="lg"
                  disabled={busy !== null}
                  onClick={() => transition(next)}
                >
                  {busy === next ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : next === "COMPLETED" ? (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  ) : (
                    <ChevronRight className="mr-2 h-4 w-4" />
                  )}
                  Mark as {orderStatusLabel(next)}
                </Button>
              ))}
              {canCancel && (
                <Button
                  variant="outline"
                  className="w-full text-destructive hover:bg-destructive/10"
                  disabled={busy !== null}
                  onClick={() => setConfirmCancel(true)}
                >
                  <Ban className="mr-2 h-4 w-4" />
                  Cancel order
                </Button>
              )}
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancel this order?"
        description={`Order #${order.orderNumber} will be marked cancelled. This cannot be undone.`}
        confirmLabel="Yes, cancel it"
        destructive
        onConfirm={() => transition("CANCELLED")}
      />
    </>
  );
}
