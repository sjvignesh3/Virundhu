"use client";

import * as React from "react";
import { Printer, Info, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/owner/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Receipt } from "@/features/orders/receipt";
import { useCollection } from "@/lib/repositories/repo-provider";
import { useDemoStore } from "@/lib/hooks/use-demo-store";
import type { Order } from "@/lib/domain/types";
import { formatCurrency } from "@/lib/utils";

export default function PrintersPage() {
  const { store, loading: storeLoading } = useDemoStore();
  const [printing, setPrinting] = React.useState<Order | null>(null);

  const loader = React.useCallback(
    async (repos: import("@/lib/repositories").Repos) => {
      if (!store) return [] as Order[];
      const list = await repos.orders.list(store.id);
      return list.slice(0, 10);
    },
    [store],
  );
  const { data: orders, loading } = useCollection("orders", loader);

  function print(order: Order) {
    setPrinting(order);
    // Wait a tick so React can render the receipt before print dialog opens.
    requestAnimationFrame(() => {
      window.print();
      setTimeout(() => setPrinting(null), 500);
    });
  }

  if (storeLoading || !store) {
    return (
      <div className="space-y-6">
        <PageHeader title="Printers" description="Loading…" />
      </div>
    );
  }

  return (
    <div className="space-y-6 print:hidden">
      <PageHeader
        title="Printers"
        description="Print receipts through your device's built-in print dialog."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How it works</CardTitle>
          <CardDescription>Phase 1: browser print. Thermal / Bluetooth support later.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Click <b className="text-foreground">Print</b> next to any order below. The
              receipt is styled for 80&nbsp;mm thermal rolls but works on any A4/A5 printer
              too — your OS handles the rest.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent orders</CardTitle>
          <CardDescription>Last 10 orders — click Print to reprint.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading && !orders ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading orders
            </div>
          ) : !orders || orders.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<Printer className="h-6 w-6" />}
                title="No orders yet"
                description="Place a test order first — then come back to print a receipt."
              />
            </div>
          ) : (
            <ul className="divide-y">
              {orders.map((o) => (
                <li key={o.id} className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold tabular-nums">#{o.orderNumber}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {o.items.reduce((s, i) => s + i.quantity, 0)} items ·{" "}
                      {formatCurrency(o.total)}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => print(o)}>
                    <Printer className="mr-2 h-4 w-4" /> Print
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Hidden receipt — visible only during print. */}
      {printing && (
        <div className="print-receipt-wrapper">
          <Receipt store={store} order={printing} />
        </div>
      )}

      <style jsx global>{`
        .print-receipt-wrapper {
          position: fixed;
          left: -10000px;
          top: 0;
        }
        @media print {
          body * {
            visibility: hidden;
          }
          .print-receipt-wrapper,
          .print-receipt-wrapper * {
            visibility: visible;
          }
          .print-receipt-wrapper {
            position: fixed;
            left: 0;
            top: 0;
            width: 80mm;
            padding: 4mm;
          }
          .receipt {
            font-family: "Courier New", monospace;
            color: #000;
          }
        }
      `}</style>
    </div>
  );
}
