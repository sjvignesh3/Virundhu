import { describe, expect, it } from "vitest";
import { buildUpiIntentUrl } from "./upi";

describe("buildUpiIntentUrl", () => {
  const base = {
    vpa: "merchant@okhdfcbank",
    payeeName: "Anna Street Food",
    amount: 250,
    orderNumber: "A-000042",
  };

  it("builds a well-formed upi:// URL", () => {
    const url = buildUpiIntentUrl(base)!;
    expect(url.startsWith("upi://pay?")).toBe(true);
    const q = new URLSearchParams(url.split("?")[1]);
    expect(q.get("pa")).toBe("merchant@okhdfcbank");
    expect(q.get("pn")).toBe("Anna Street Food");
    expect(q.get("am")).toBe("250.00");
    expect(q.get("cu")).toBe("INR");
    expect(q.get("tn")).toBe("Order A-000042");
  });

  it("rounds amount to two decimal places", () => {
    const url = buildUpiIntentUrl({ ...base, amount: 199.5 })!;
    const q = new URLSearchParams(url.split("?")[1]);
    expect(q.get("am")).toBe("199.50");
  });

  it("percent-encodes non-ASCII payee names", () => {
    const url = buildUpiIntentUrl({ ...base, payeeName: "விருந்து" })!;
    // Non-ASCII must round-trip via decodeURIComponent.
    const q = new URLSearchParams(url.split("?")[1]);
    expect(q.get("pn")).toBe("விருந்து");
  });

  it("rejects malformed VPA", () => {
    expect(buildUpiIntentUrl({ ...base, vpa: "notavpa" })).toBeNull();
    expect(buildUpiIntentUrl({ ...base, vpa: "" })).toBeNull();
    expect(buildUpiIntentUrl({ ...base, vpa: "spaces in@handle" })).toBeNull();
  });

  it("rejects non-positive amounts", () => {
    expect(buildUpiIntentUrl({ ...base, amount: 0 })).toBeNull();
    expect(buildUpiIntentUrl({ ...base, amount: -10 })).toBeNull();
    expect(buildUpiIntentUrl({ ...base, amount: Number.NaN })).toBeNull();
  });

  it("rejects empty payee or order number", () => {
    expect(buildUpiIntentUrl({ ...base, payeeName: "  " })).toBeNull();
    expect(buildUpiIntentUrl({ ...base, orderNumber: "" })).toBeNull();
  });

  it("normalises VPA to lowercase", () => {
    const url = buildUpiIntentUrl({ ...base, vpa: "Merchant@OKHDFCBANK" })!;
    const q = new URLSearchParams(url.split("?")[1]);
    expect(q.get("pa")).toBe("merchant@okhdfcbank");
  });
});
