import { describe, it, expect } from "vitest";
import {
  canTransition,
  isTerminal,
  nextValidStatuses,
  ACTIVE_STATUS_FLOW,
  ALL_STATUSES,
} from "./order-status";

describe("order-status state machine", () => {
  it("permits forward flow NEW → ACCEPTED → PREPARING → READY → COMPLETED", () => {
    expect(canTransition("NEW", "ACCEPTED")).toBe(true);
    expect(canTransition("ACCEPTED", "PREPARING")).toBe(true);
    expect(canTransition("PREPARING", "READY")).toBe(true);
    expect(canTransition("READY", "COMPLETED")).toBe(true);
  });

  it("permits cancellation from every active state", () => {
    for (const s of ACTIVE_STATUS_FLOW) {
      expect(canTransition(s, "CANCELLED")).toBe(true);
    }
  });

  it("rejects backward transitions", () => {
    expect(canTransition("ACCEPTED", "NEW")).toBe(false);
    expect(canTransition("READY", "PREPARING")).toBe(false);
    expect(canTransition("COMPLETED", "READY")).toBe(false);
  });

  it("rejects skipping states", () => {
    expect(canTransition("NEW", "READY")).toBe(false);
    expect(canTransition("NEW", "COMPLETED")).toBe(false);
    expect(canTransition("ACCEPTED", "COMPLETED")).toBe(false);
  });

  it("terminal states have no outgoing transitions", () => {
    expect(isTerminal("COMPLETED")).toBe(true);
    expect(isTerminal("CANCELLED")).toBe(true);
    expect(nextValidStatuses("COMPLETED")).toEqual([]);
    expect(nextValidStatuses("CANCELLED")).toEqual([]);
  });

  it("active states are not terminal", () => {
    for (const s of ACTIVE_STATUS_FLOW) {
      expect(isTerminal(s)).toBe(false);
    }
  });

  it("cannot re-cancel a cancelled order", () => {
    expect(canTransition("CANCELLED", "CANCELLED")).toBe(false);
    expect(canTransition("COMPLETED", "CANCELLED")).toBe(false);
  });

  it("returns a fresh array from nextValidStatuses (defensive copy)", () => {
    const a = nextValidStatuses("NEW");
    const b = nextValidStatuses("NEW");
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    a.push("COMPLETED");
    expect(nextValidStatuses("NEW")).not.toContain("COMPLETED");
  });

  it("ALL_STATUSES covers every state exactly once", () => {
    const set = new Set(ALL_STATUSES);
    expect(set.size).toBe(ALL_STATUSES.length);
    expect(set.size).toBe(6);
  });
});
