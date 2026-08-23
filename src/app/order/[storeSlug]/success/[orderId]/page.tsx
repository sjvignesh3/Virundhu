"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/utils";
import { useCollection, useRepos } from "@/lib/repositories/repo-provider";
import type { Order } from "@/lib/domain/types";

export default function OrderSuccessPage() {
  const params = useParams<{ storeSlug: string; orderId: string }>();
  const repos = useRepos();

  const loader = React.useCallback(
    async (r: import("@/lib/repositories").Repos) => r.orders.get(params.orderId),
    [params.orderId],
  );
  const { data: order, loading } = useCollection("orders", loader);

  if (!repos || loading) return null;

  if (!order) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <EmptyState
          title="Order not found"
          description="We couldn't find this order. It may have been cleared from local storage."
          action={
            <Button asChild>
              <Link href={`/order/${params.storeSlug}`}>Back to menu</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:py-12">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold">Order placed!</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The kitchen has been notified.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Order number</p>
              <p className="text-lg font-bold tabular-nums">{order.orderNumber}</p>
            </div>
            <StatusBadge status={order.status} />
          </div>

          <div className="rounded-md border p-3">
            <p className="mb-2 text-sm font-semibold">Items</p>
            <ul className="space-y-1 text-sm">
              {order.items.map((item, i) => (
                <li key={`${item.productId}-${i}`} className="flex justify-between gap-2">
                  <span className="min-w-0">
                    {item.quantity} × {item.name}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatCurrency(item.lineTotal)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">{formatCurrency(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <span>Total paid</span>
              <span className="tabular-nums">{formatCurrency(order.total)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              via {order.paymentMethod.toLowerCase()} ({order.paymentStatus.toLowerCase()})
            </p>
          </div>

          {(order.customer.name || order.customer.phone || order.customer.note) && (
            <div className="space-y-0.5 rounded-md bg-muted/50 p-3 text-sm">
              {order.customer.name && <p>Name: {order.customer.name}</p>}
              {order.customer.phone && <p>Phone: {order.customer.phone}</p>}
              {order.customer.note && (
                <p className="text-muted-foreground">Note: {order.customer.note}</p>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 rounded-md bg-primary/10 p-3 text-sm text-primary">
            <Clock className="h-4 w-4 shrink-0" />
            <span>Please wait for your order to be prepared.</span>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Button asChild variant="outline" className="flex-1">
          <Link href={`/order/${params.storeSlug}`}>Order more</Link>
        </Button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Order["status"] }) {
  const map: Record<Order["status"], { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }> = {
    NEW: { label: "New", variant: "info" },
    ACCEPTED: { label: "Accepted", variant: "info" },
    PREPARING: { label: "Preparing", variant: "warning" },
    READY: { label: "Ready", variant: "success" },
    COMPLETED: { label: "Completed", variant: "success" },
    CANCELLED: { label: "Cancelled", variant: "destructive" },
  };
  const { label, variant } = map[status];
  return <Badge variant={variant}>{label}</Badge>;
}
