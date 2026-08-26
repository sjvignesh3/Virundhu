import { describe, expect, it, vi } from "vitest";
import {
  LogNotificationDispatcher,
  NOTIFIABLE_KINDS,
  notificationKindFor,
  renderNotificationText,
  shouldNotify,
  type NotificationPayload,
} from "./notifications";

const payload: NotificationPayload = {
  orderId: "o1",
  storeId: "s1",
  orderNumber: "A-20260901-0007",
  customerPhone: "+919000000000",
  customerName: "Asha",
  storeName: "Anna Street Food",
};

describe("notificationKindFor", () => {
  it("maps notifiable statuses", () => {
    expect(notificationKindFor("ACCEPTED")).toBe("ORDER_ACCEPTED");
    expect(notificationKindFor("READY")).toBe("ORDER_READY");
    expect(notificationKindFor("COMPLETED")).toBe("ORDER_COMPLETED");
    expect(notificationKindFor("CANCELLED")).toBe("ORDER_CANCELLED");
  });

  it("returns null for non-notifiable statuses", () => {
    expect(notificationKindFor("NEW")).toBeNull();
    expect(notificationKindFor("PREPARING")).toBeNull();
  });
});

describe("shouldNotify", () => {
  it("accepts a legal, notifiable transition", () => {
    const r = shouldNotify("NEW", "ACCEPTED");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.kind).toBe("ORDER_ACCEPTED");
  });

  it("rejects a no-op transition", () => {
    const r = shouldNotify("READY", "READY");
    expect(r).toEqual({ ok: false, reason: "NO_OP_TRANSITION" });
  });

  it("rejects an illegal transition (reuses shared state machine)", () => {
    const r = shouldNotify("NEW", "COMPLETED");
    expect(r).toEqual({ ok: false, reason: "INVALID_TRANSITION" });
  });

  it("rejects a legal-but-non-notifiable transition", () => {
    // ACCEPTED -> PREPARING is legal but intentionally not notified.
    const r = shouldNotify("ACCEPTED", "PREPARING");
    expect(r).toEqual({ ok: false, reason: "NON_NOTIFIABLE_STATUS" });
  });
});

describe("renderNotificationText", () => {
  it("includes order number and store name for every kind", () => {
    for (const kind of NOTIFIABLE_KINDS) {
      const text = renderNotificationText(kind, payload);
      expect(text).toContain(payload.orderNumber);
      expect(text).toContain(payload.storeName);
      expect(text).toContain(payload.customerName!);
    }
  });

  it("falls back gracefully when the customer name is missing", () => {
    const text = renderNotificationText("ORDER_READY", { ...payload, customerName: null });
    expect(text).toContain("Your");
    expect(text).toContain(payload.orderNumber);
  });
});

describe("LogNotificationDispatcher", () => {
  it("emits a structured line through the injected sink", async () => {
    const sink = vi.fn();
    const d = new LogNotificationDispatcher(sink);
    await d.send("ORDER_ACCEPTED", payload);
    expect(sink).toHaveBeenCalledTimes(1);
    const [tag, kind, detail] = sink.mock.calls[0];
    expect(tag).toBe("[notify]");
    expect(kind).toBe("ORDER_ACCEPTED");
    expect(detail).toMatchObject({ orderNumber: payload.orderNumber });
    expect(detail.text).toContain(payload.storeName);
  });
});
