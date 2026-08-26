/**
 * Public-menu cart store — Zustand vanilla with sessionStorage persistence
 * (Plan §4.3). Persistence rules:
 *
 *  - Keyed per slug: `virundhu:cart:v1:<slug>`. Switching slug resets the
 *    active cart so a customer can't accidentally check out with items from
 *    a different store.
 *  - sessionStorage (not localStorage): survives reload + navigation within
 *    the same tab, drops when the tab closes. Matches customer intent for
 *    a one-shot ordering session.
 *  - Guarded for SSR / test environments — every touch of `sessionStorage`
 *    goes through `safeStorage()`, which no-ops when the API is absent.
 */
import { createStore } from "zustand/vanilla";
import { useSyncExternalStore } from "react";

export interface CartLine {
  productId: string;
  name: string;
  tamilName: string | null;
  unitPrice: number; // rupees
  quantity: number;
}

interface CartState {
  slug: string | null;
  lines: CartLine[];
  add: (line: Omit<CartLine, "quantity">, delta?: number) => void;
  remove: (productId: string) => void;
  setQty: (productId: string, quantity: number) => void;
  clear: () => void;
  setSlug: (slug: string) => void;
}

const STORAGE_PREFIX = "virundhu:cart:v1:";

function safeStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function loadLines(slug: string): CartLine[] {
  const s = safeStorage();
  if (!s) return [];
  try {
    const raw = s.getItem(STORAGE_PREFIX + slug);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    // Cheap shape guard; drop anything that isn't a plausible line.
    return parsed.filter(
      (l): l is CartLine =>
        typeof l === "object" &&
        l !== null &&
        typeof (l as CartLine).productId === "string" &&
        typeof (l as CartLine).quantity === "number" &&
        (l as CartLine).quantity > 0,
    );
  } catch {
    return [];
  }
}

function saveLines(slug: string | null, lines: CartLine[]): void {
  const s = safeStorage();
  if (!s || !slug) return;
  try {
    if (lines.length === 0) s.removeItem(STORAGE_PREFIX + slug);
    else s.setItem(STORAGE_PREFIX + slug, JSON.stringify(lines));
  } catch {
    /* quota exceeded or storage disabled → silent no-op */
  }
}

export const cartStore = createStore<CartState>((set, get) => ({
  slug: null,
  lines: [],
  setSlug: (slug) =>
    set((s) => {
      if (s.slug === slug) return s;
      const lines = loadLines(slug);
      return { slug, lines };
    }),
  add: (line, delta = 1) =>
    set((s) => {
      const existing = s.lines.find((l) => l.productId === line.productId);
      let lines: CartLine[];
      if (existing) {
        lines = s.lines
          .map((l) =>
            l.productId === line.productId
              ? { ...l, quantity: Math.max(0, l.quantity + delta) }
              : l,
          )
          .filter((l) => l.quantity > 0);
      } else if (delta <= 0) {
        return s;
      } else {
        lines = [...s.lines, { ...line, quantity: delta }];
      }
      saveLines(s.slug, lines);
      return { lines };
    }),
  remove: (productId) => {
    const lines = get().lines.filter((l) => l.productId !== productId);
    saveLines(get().slug, lines);
    set({ lines });
  },
  setQty: (productId, quantity) => {
    const lines = get()
      .lines.map((l) => (l.productId === productId ? { ...l, quantity } : l))
      .filter((l) => l.quantity > 0);
    saveLines(get().slug, lines);
    set({ lines });
  },
  clear: () => {
    saveLines(get().slug, []);
    set({ lines: [] });
  },
}));

export function useCart<T>(selector: (s: CartState) => T): T {
  return useSyncExternalStore(
    cartStore.subscribe,
    () => selector(cartStore.getState()),
    () => selector(cartStore.getState()),
  );
}

export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((s, l) => s + l.quantity, 0);
}

/** Test-only reset — clears memory + all sessionStorage cart keys. */
export function _resetCartForTests(): void {
  const s = safeStorage();
  if (s) {
    for (let i = s.length - 1; i >= 0; i--) {
      const k = s.key(i);
      if (k && k.startsWith(STORAGE_PREFIX)) s.removeItem(k);
    }
  }
  cartStore.setState({ slug: null, lines: [] });
}
