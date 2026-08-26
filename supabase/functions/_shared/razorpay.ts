/**
 * Razorpay webhook signature verification.
 *
 * Razorpay signs the raw request body with HMAC-SHA256 keyed by the webhook
 * secret and sends it in the `x-razorpay-signature` header (hex). We verify
 * against the RAW body (never the parsed JSON) using the Web Crypto API — no
 * Node `crypto` dependency, works natively in Deno.
 *
 * Comparison is constant-time to avoid timing side-channels.
 */

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase();
  if (clean.length % 2 !== 0) return new Uint8Array();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) return new Uint8Array();
    out[i] = byte;
  }
  return out;
}

/** Constant-time byte comparison. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * Returns true when `signatureHex` is a valid HMAC-SHA256 of `rawBody` under
 * `secret`. Async because Web Crypto's `sign` is Promise-based.
 */
export async function verifyRazorpaySignature(
  rawBody: string,
  signatureHex: string,
  secret: string,
): Promise<boolean> {
  if (!signatureHex || !secret) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  const expected = new Uint8Array(mac);
  const provided = hexToBytes(signatureHex);
  return timingSafeEqual(expected, provided);
}
