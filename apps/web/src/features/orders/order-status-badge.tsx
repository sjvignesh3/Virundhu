import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/lib/domain/types";

const STYLES: Record<OrderStatus, string> = {
  NEW: "bg-info/10 text-info border-info/20",
  ACCEPTED: "bg-primary/10 text-primary border-primary/20",
  PREPARING: "bg-warning/10 text-warning border-warning/20",
  READY: "bg-success/10 text-success border-success/20",
  COMPLETED: "bg-muted text-muted-foreground border-border",
  CANCELLED: "bg-destructive/10 text-destructive border-destructive/20",
};

const LABELS: Record<OrderStatus, string> = {
  NEW: "New",
  ACCEPTED: "Accepted",
  PREPARING: "Preparing",
  READY: "Ready",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export function OrderStatusBadge({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        STYLES[status],
        className,
      )}
    >
      {LABELS[status]}
    </span>
  );
}

export function orderStatusLabel(status: OrderStatus): string {
  return LABELS[status];
}
