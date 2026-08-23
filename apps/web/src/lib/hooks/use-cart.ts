"use client";

import * as React from "react";
import type { Product } from "@/lib/domain/types";
import { buildOrderItem } from "@/lib/domain/totals";

/**
 * Small cart state for the customer ordering page.
 *
 * Persisted in `sessionStorage` scoped by store slug so:
 *   - a page refresh keeps the cart,
 *   - opening a different store in a new tab starts empty,
 *   - closing the tab discards it (this is *not* an owner-facing draft).
 *
 * We store only `{ productId, quantity }` and resolve product details at
 * render time — that way a price/name change in the owner's catalog is
 * reflected in the customer's live cart before checkout. Once the order is
 * created, `buildOrderItem` snapshots the current price/name onto the order.
 */

export interface CartLine {
  productId: string;
  quantity: number;
}

interface CartState {
  storeSlug: string | null;
  lines: CartLine[];
}

type Action =
  | { type: "INIT"; storeSlug: string; lines: CartLine[] }
  | { type: "ADD"; productId: string }
  | { type: "REMOVE"; productId: string }
  | { type: "SET"; productId: string; quantity: number }
  | { type: "CLEAR" };

function reducer(state: CartState, action: Action): CartState {
  switch (action.type) {
    case "INIT":
      return { storeSlug: action.storeSlug, lines: action.lines };
    case "ADD": {
      const idx = state.lines.findIndex((l) => l.productId === action.productId);
      if (idx === -1) {
        return { ...state, lines: [...state.lines, { productId: action.productId, quantity: 1 }] };
      }
      const next = [...state.lines];
      next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
      return { ...state, lines: next };
    }
    case "REMOVE": {
      const idx = state.lines.findIndex((l) => l.productId === action.productId);
      if (idx === -1) return state;
      const current = state.lines[idx];
      if (current.quantity <= 1) {
        return { ...state, lines: state.lines.filter((l) => l.productId !== action.productId) };
      }
      const next = [...state.lines];
      next[idx] = { ...current, quantity: current.quantity - 1 };
      return { ...state, lines: next };
    }
    case "SET": {
      if (action.quantity <= 0) {
        return { ...state, lines: state.lines.filter((l) => l.productId !== action.productId) };
      }
      const idx = state.lines.findIndex((l) => l.productId === action.productId);
      if (idx === -1) {
        return {
          ...state,
          lines: [...state.lines, { productId: action.productId, quantity: action.quantity }],
        };
      }
      const next = [...state.lines];
      next[idx] = { ...next[idx], quantity: action.quantity };
      return { ...state, lines: next };
    }
    case "CLEAR":
      return { ...state, lines: [] };
  }
}

function storageKey(slug: string): string {
  return `cartsas:v1:cart:${slug}`;
}

export interface UseCartResult {
  lines: CartLine[];
  itemCount: number;
  add: (productId: string) => void;
  remove: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
  /** Compute a subtotal against a product lookup. Missing/unavailable products contribute 0. */
  subtotal: (products: readonly Product[]) => number;
  /** Build the OrderItem snapshot list for `OrderRepo.create`. */
  toOrderItems: (products: readonly Product[]) => ReturnType<typeof buildOrderItem>[];
}

export function useCart(storeSlug: string | null): UseCartResult {
  const [state, dispatch] = React.useReducer(reducer, {
    storeSlug: null,
    lines: [],
  } as CartState);

  // Hydrate from sessionStorage on mount / whenever the slug changes.
  React.useEffect(() => {
    if (!storeSlug) return;
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(storageKey(storeSlug));
      const lines: CartLine[] = raw ? JSON.parse(raw) : [];
      dispatch({ type: "INIT", storeSlug, lines: Array.isArray(lines) ? lines : [] });
    } catch {
      dispatch({ type: "INIT", storeSlug, lines: [] });
    }
  }, [storeSlug]);

  // Persist on every change (but only after INIT so we don't clobber storage
  // during the initial render with an empty lines list).
  React.useEffect(() => {
    if (!storeSlug || state.storeSlug !== storeSlug) return;
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(storageKey(storeSlug), JSON.stringify(state.lines));
    } catch {
      // Storage quota / private mode — silently ignore.
    }
  }, [state.lines, state.storeSlug, storeSlug]);

  const itemCount = React.useMemo(
    () => state.lines.reduce((sum, l) => sum + l.quantity, 0),
    [state.lines],
  );

  const subtotal = React.useCallback(
    (products: readonly Product[]) => {
      const byId = new Map(products.map((p) => [p.id, p]));
      let total = 0;
      for (const line of state.lines) {
        const p = byId.get(line.productId);
        if (!p || !p.available) continue;
        total += p.price * line.quantity;
      }
      return total;
    },
    [state.lines],
  );

  const toOrderItems = React.useCallback(
    (products: readonly Product[]) => {
      const byId = new Map(products.map((p) => [p.id, p]));
      const items = [];
      for (const line of state.lines) {
        const p = byId.get(line.productId);
        if (!p || !p.available || line.quantity <= 0) continue;
        items.push(buildOrderItem(p, line.quantity));
      }
      return items;
    },
    [state.lines],
  );

  return {
    lines: state.lines,
    itemCount,
    add: React.useCallback((productId: string) => dispatch({ type: "ADD", productId }), []),
    remove: React.useCallback((productId: string) => dispatch({ type: "REMOVE", productId }), []),
    setQuantity: React.useCallback(
      (productId: string, quantity: number) => dispatch({ type: "SET", productId, quantity }),
      [],
    ),
    clear: React.useCallback(() => dispatch({ type: "CLEAR" }), []),
    subtotal,
    toOrderItems,
  };
}
