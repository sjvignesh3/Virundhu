/**
 * Order state machine — the single source of truth for allowed transitions.
 * Used by both frontend (for enabling/disabling UI buttons) and backend
 * (for authoritative enforcement in OrderService).
 */

import type { OrderStatus } from "./enums";

const TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  NEW: ["ACCEPTED", "CANCELLED"],
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
