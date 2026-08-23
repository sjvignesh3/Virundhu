import { describe, it, expect } from "vitest";
import {
  generateOrderNumber,
  ORDER_NUMBER_PREFIX,
  ORDER_NUMBER_SEQ_START,
} from "./order-number";

describe("generateOrderNumber", () => {
  it("uses the FC prefix and starts at 1001", () => {
    expect(ORDER_NUMBER_PREFIX).toBe("FC");
    expect(ORDER_NUMBER_SEQ_START).toBe(1001);
    expect(generateOrderNumber(1)).toBe("FC-1002");
    expect(generateOrderNumber(0)).toBe("FC-1001");
  });

  it("increments monotonically", () => {
    expect(generateOrderNumber(23)).toBe("FC-1024");
    expect(generateOrderNumber(999)).toBe("FC-2000");
  });

  it("rejects negative / non-integer seq", () => {
    expect(() => generateOrderNumber(-1)).toThrow();
    expect(() => generateOrderNumber(1.5)).toThrow();
    expect(() => generateOrderNumber(Number.NaN)).toThrow();
  });
});
