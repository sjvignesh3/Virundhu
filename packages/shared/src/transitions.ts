/**
 * Order state machine â€” the single source of truth for allowed transitions.
 * Used by both frontend (for enabling/disabling UI buttons) and backend
 * (for authoritative enforcement in OrderService).
 */

import type { OrderStatus } from "./enums.ts";

const TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  // Stage 9.1: ACCEPTED is fully retired — the flow is NEW → PREPARING →
  // READY → COMPLETED. ACCEPTED remains a legal SOURCE only, as an escape
  // hatch for rows written by stale clients mid-deploy (a data migration
  // moved all existing ACCEPTED rows to PREPARING).
  // Mirror: public.orders_can_transition (migration 20260901002800).
  NEW: ["PREPARING", "CANCELLED"],
  ACCEPTED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function nextValidStatuses(from: OrderStatus): readonly OrderStatus[] {
  return TRANSITIONS[from];
}

export function isTerminal(status: OrderStatus): boolean {
  return status === "COMPLETED" || status === "CANCELLED";
}

export const ACTIVE_STATUS_FLOW: readonly OrderStatus[] = [
  "NEW",
  "ACCEPTED",
  "PREPARING",
  "READY",
] as const;
