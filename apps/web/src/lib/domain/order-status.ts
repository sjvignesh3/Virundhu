import type { OrderStatus } from './types';

/**
 * Allowed forward transitions of the order state machine.
 *
 *   NEW ─▶ ACCEPTED ─▶ PREPARING ─▶ READY ─▶ COMPLETED
 *     │        │           │          │
 *     └────────┴───────────┴──────────┴──▶ CANCELLED
 *
 * Terminal states: COMPLETED, CANCELLED (no outgoing transitions).
 */
const TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  NEW: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function nextValidStatuses(current: OrderStatus): OrderStatus[] {
  return [...TRANSITIONS[current]];
}

export function canTransition(current: OrderStatus, next: OrderStatus): boolean {
  return TRANSITIONS[current].includes(next);
}

export function isTerminal(status: OrderStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/** Ordered list for Kanban column layout (excludes CANCELLED, shown separately). */
export const ACTIVE_STATUS_FLOW: readonly OrderStatus[] = [
  'NEW',
  'ACCEPTED',
  'PREPARING',
  'READY',
] as const;

export const ALL_STATUSES: readonly OrderStatus[] = [
  'NEW',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'COMPLETED',
  'CANCELLED',
] as const;
