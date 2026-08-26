/**
 * Deno test for the Razorpay HMAC-SHA256 signature verifier.
 * Run:  deno test --import-map=supabase/import_map.json supabase/functions/_shared/razorpay.test.ts
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { verifyRazorpaySignature } from "./razorpay.ts";

const SECRET = "whsec_test_123";
const BODY = JSON.stringify({
  id: "evt_test_1",
  event: "payment.captured",
  payload: { payment: { entity: { id: "pay_abc", notes: { order_id: "o1" } } } },
});

async function sign(body: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.test("accepts a correctly signed body", async () => {
  const sig = await sign(BODY, SECRET);
  assertEquals(await verifyRazorpaySignature(BODY, sig, SECRET), true);
});

Deno.test("rejects a tampered body", async () => {
  const sig = await sign(BODY, SECRET);
  assertEquals(await verifyRazorpaySignature(BODY + " ", sig, SECRET), false);
});

Deno.test("rejects the wrong secret", async () => {
  const sig = await sign(BODY, SECRET);
  assertEquals(await verifyRazorpaySignature(BODY, sig, "whsec_wrong"), false);
});

Deno.test("rejects an empty signature", async () => {
  assertEquals(await verifyRazorpaySignature(BODY, "", SECRET), false);
});

Deno.test("rejects a malformed hex signature", async () => {
  assertEquals(await verifyRazorpaySignature(BODY, "zzzz", SECRET), false);
});
