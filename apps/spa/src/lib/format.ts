/**
 * Money is RUPEES end-to-end — the DB stores numeric(12,2) rupee values
 * (seed: Chicken Biriyani = 180.00) and `@virundhu/shared` totals operate
 * on rupee decimals. Never divide or multiply by 100 anywhere in the SPA
 * (the 2026-08-29 audit found a paise/rupee split that displayed ₹180 as
 * ₹2 and stored owner-entered ₹50 as ₹5000).
 */
const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const inrExact = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Whole-rupee display (₹180). Use for menus, cards, stats. */
export function formatCurrency(rupees: number): string {
  return inr.format(rupees);
}

/** Paise-exact display (₹180.50). Use for receipts and reports. */
export function formatCurrencyExact(rupees: number): string {
  return inrExact.format(rupees);
}

export function formatTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

/** "42s ago" / "5m ago" / "2h ago" — live-board card age. */
export function formatAgo(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const secs = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}
