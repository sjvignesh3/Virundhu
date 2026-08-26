import { describe, expect, it, beforeEach } from "vitest";
import { cartStore, cartSubtotal, cartCount, _resetCartForTests } from "./cart";

const line = (id: string, price: number) => ({
  productId: id,
  name: `Product ${id}`,
  tamilName: null,
  unitPrice: price,
});

describe("cartStore", () => {
  beforeEach(() => {
    _resetCartForTests();
  });

  it("adds items and increments qty", () => {
    cartStore.getState().add(line("A", 1000), 1);
    cartStore.getState().add(line("A", 1000), 2);
    const lines = cartStore.getState().lines;
    expect(lines).toHaveLength(1);
    expect(lines[0]?.quantity).toBe(3);
  });

  it("removes at zero quantity", () => {
    cartStore.getState().add(line("A", 1000), 2);
    cartStore.getState().add(line("A", 1000), -2);
    expect(cartStore.getState().lines).toHaveLength(0);
  });

  it("resets when slug changes", () => {
    cartStore.getState().setSlug("shop-a");
    cartStore.getState().add(line("A", 1000), 1);
    cartStore.getState().setSlug("shop-b");
    expect(cartStore.getState().lines).toHaveLength(0);
    expect(cartStore.getState().slug).toBe("shop-b");
  });

  it("computes subtotal and count", () => {
    cartStore.getState().add(line("A", 500), 2);
    cartStore.getState().add(line("B", 300), 3);
    const lines = cartStore.getState().lines;
    expect(cartSubtotal(lines)).toBe(500 * 2 + 300 * 3);
    expect(cartCount(lines)).toBe(5);
  });

  it("persists per-slug across setSlug round-trips", () => {
    cartStore.getState().setSlug("shop-a");
    cartStore.getState().add(line("A", 500), 2);
    // Switch away then back — the shop-a cart should reappear.
    cartStore.getState().setSlug("shop-b");
    expect(cartStore.getState().lines).toHaveLength(0);
    cartStore.getState().setSlug("shop-a");
    expect(cartStore.getState().lines).toHaveLength(1);
    expect(cartStore.getState().lines[0]?.quantity).toBe(2);
  });

  it("clears sessionStorage when cart is emptied", () => {
    cartStore.getState().setSlug("shop-c");
    cartStore.getState().add(line("A", 500), 1);
    expect(window.sessionStorage.getItem("virundhu:cart:v1:shop-c")).not.toBeNull();
    cartStore.getState().clear();
    expect(window.sessionStorage.getItem("virundhu:cart:v1:shop-c")).toBeNull();
  });
});
