import { canTransition, nextValidStatuses } from "@virundhu/shared";

/**
 * Pure unit tests over the shared state machine. OrderStatusService delegates
 * to these predicates, so testing them here guarantees the backend enforces
 * exactly what the frontend UI enables.
 */
describe("OrderStatusService state machine (via shared)", () => {
  it("allows the happy path", () => {
    expect(canTransition("NEW", "ACCEPTED")).toBe(true);
    expect(canTransition("ACCEPTED", "PREPARING")).toBe(true);
    expect(canTransition("PREPARING", "READY")).toBe(true);
    expect(canTransition("READY", "COMPLETED")).toBe(true);
  });

  it("rejects backwards transitions", () => {
    expect(canTransition("ACCEPTED", "NEW")).toBe(false);
    expect(canTransition("READY", "PREPARING")).toBe(false);
  });

  it("rejects skipping steps", () => {
    expect(canTransition("NEW", "PREPARING")).toBe(false);
    expect(canTransition("NEW", "COMPLETED")).toBe(false);
    expect(canTransition("ACCEPTED", "COMPLETED")).toBe(false);
  });

  it("allows cancel from any active state", () => {
    expect(canTransition("NEW", "CANCELLED")).toBe(true);
    expect(canTransition("ACCEPTED", "CANCELLED")).toBe(true);
    expect(canTransition("PREPARING", "CANCELLED")).toBe(true);
    expect(canTransition("READY", "CANCELLED")).toBe(true);
  });

  it("locks terminal states", () => {
    expect(canTransition("COMPLETED", "READY")).toBe(false);
    expect(canTransition("COMPLETED", "CANCELLED")).toBe(false);
    expect(canTransition("CANCELLED", "NEW")).toBe(false);
    expect(nextValidStatuses("COMPLETED")).toEqual([]);
    expect(nextValidStatuses("CANCELLED")).toEqual([]);
  });
});
