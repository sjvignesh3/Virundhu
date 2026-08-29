/**
 * UPI deep-link builder — Stage 7.
 *
 * Generates a NPCI-compliant `upi://pay?...` intent URL. On mobile devices
 * this hands off to the customer's installed UPI app (PhonePe, GPay, Paytm,
 * BHIM, …). On desktop most browsers show a "open in app" chooser or fall
 * back to nothing — the receipt page still shows the VPA so the customer
 * can pay manually.
 *
 * We deliberately do not include the `tr` (transaction reference) parameter
 * a PSP would use for automatic reconciliation — v1 has no gateway to
 * reconcile against. The `tn` (note) still carries the order number so the
 * vendor can match manually.
 *
 * NPCI spec: https://www.npci.org.in/PDF/npci/upi/circular/2019/UPI_OC_88_UPI_Linking_Specifications.pdf
 */

export interface UpiIntentArgs {
  /** Vendor Virtual Payment Address, e.g. `merchant@okhdfcbank`. */
  vpa: string;
  /** Vendor display name (shown inside the UPI app). */
  payeeName: string;
  /** Amount in rupees. Must be > 0 and rounded to 2dp. */
  amount: number;
  /** Order number → surfaces to the vendor for manual reconciliation. */
  orderNumber: string;
  /** ISO-4217 currency code. NPCI requires INR. */
  currency?: "INR";
}

/**
 * Returns `null` when any required argument is missing or malformed. The
 * caller (`CheckoutSheet`) treats a null result as "UPI unavailable" and
 * falls back to a plain success page.
 */
export function buildUpiIntentUrl(args: UpiIntentArgs): string | null {
  const vpa = (args.vpa ?? "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{1,49}@[a-z][a-z0-9]{2,29}$/.test(vpa)) return null;

  const payee = (args.payeeName ?? "").trim();
  if (!payee) return null;

  if (!Number.isFinite(args.amount) || args.amount <= 0) return null;
  const amount = args.amount.toFixed(2);

  const orderNumber = (args.orderNumber ?? "").trim();
  if (!orderNumber) return null;

  // encodeURIComponent covers the reserved characters listed in the NPCI
  // spec — spaces, `&`, `#`, `+`, non-ASCII — safely.
  const params = new URLSearchParams({
    pa: vpa,
    pn: payee,
    am: amount,
    cu: args.currency ?? "INR",
    tn: `Order ${orderNumber}`,
  });
  return `upi://pay?${params.toString()}`;
}
