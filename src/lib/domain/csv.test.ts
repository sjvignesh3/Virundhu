import { describe, expect, it } from "vitest";
import { csvFilename, csvRow, escapeCsvCell, ordersToCsv } from "./csv";
import type { Order } from "./types";

describe("escapeCsvCell", () => {
  it("returns empty string for null/undefined", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
  });

  it("passes through safe strings", () => {
    expect(escapeCsvCell("FC-1001")).toBe("FC-1001");
    expect(escapeCsvCell(42)).toBe("42");
  });

  it("quotes cells containing commas", () => {
    expect(escapeCsvCell("Chennai, TN")).toBe('"Chennai, TN"');
  });

  it("quotes and doubles embedded quotes", () => {
    expect(escapeCsvCell('He said "hi"')).toBe('"He said ""hi"""');
  });

  it("quotes cells with newlines", () => {
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
  });
});

describe("csvRow", () => {
  it("joins cells with commas", () => {
    expect(csvRow(["a", "b", 1])).toBe("a,b,1");
  });

  it("escapes each cell independently", () => {
    expect(csvRow(["safe", "with,comma", 'with"quote'])).toBe(
      'safe,"with,comma","with""quote"',
    );
  });
});

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "o1",
    orderNumber: "FC-1001",
    storeId: "s1",
    customer: { name: "Ravi", phone: "9000000000" },
    items: [
      {
        productId: "p1",
        name: "Chicken 65",
        unit: "plate",
        unitPrice: 140,
        quantity: 2,
        lineTotal: 280,
      },
    ],
    subtotal: 280,
    total: 280,
    paymentMethod: "SIMULATED",
    paymentStatus: "PAID",
    status: "COMPLETED",
    createdAt: "2025-01-15T10:00:00.000Z",
    updatedAt: "2025-01-15T10:30:00.000Z",
    ...overrides,
  };
}

describe("ordersToCsv", () => {
  it("emits BOM + header for an empty list", () => {
    const csv = ordersToCsv([]);
    expect(csv.startsWith("\ufeff")).toBe(true);
    expect(csv).toContain("order_number,created_at,status");
    expect(csv.split("\r\n")).toHaveLength(1);
  });

  it("uses CRLF between rows", () => {
    const csv = ordersToCsv([makeOrder()]);
    // header + 1 row
    expect(csv.split("\r\n")).toHaveLength(2);
  });

  it("serializes a completed order with correct totals", () => {
    const csv = ordersToCsv([makeOrder()]);
    const [, dataRow] = csv.split("\r\n");
    expect(dataRow).toContain("FC-1001");
    expect(dataRow).toContain("COMPLETED");
    expect(dataRow).toContain("PAID");
    expect(dataRow).toContain("Ravi");
    expect(dataRow).toContain("9000000000");
    expect(dataRow).toContain("Chicken 65 x2");
    expect(dataRow.endsWith(",2,280,280")).toBe(true);
  });

  it("summarises multi-item orders with '; ' separator", () => {
    const csv = ordersToCsv([
      makeOrder({
        items: [
          { productId: "p1", name: "Parotta", unit: "piece", unitPrice: 20, quantity: 3, lineTotal: 60 },
          { productId: "p2", name: "Tea", unit: "cup", unitPrice: 15, quantity: 2, lineTotal: 30 },
        ],
        subtotal: 90,
        total: 90,
      }),
    ]);
    expect(csv).toContain("Parotta x3; Tea x2");
    expect(csv).toContain(",5,90,90"); // item_count = 3+2
  });

  it("handles missing customer fields as empty strings", () => {
    const csv = ordersToCsv([
      makeOrder({ customer: {}, orderNumber: "FC-1002" }),
    ]);
    // two consecutive commas indicate empty name & phone
    expect(csv).toContain(",,");
  });

  it("quotes item summaries that contain commas", () => {
    const csv = ordersToCsv([
      makeOrder({
        items: [
          { productId: "p1", name: "Rice, plain", unit: "plate", unitPrice: 60, quantity: 1, lineTotal: 60 },
        ],
        subtotal: 60,
        total: 60,
      }),
    ]);
    expect(csv).toContain('"Rice, plain x1"');
  });
});

describe("csvFilename", () => {
  it("builds a dated filename with prefix and range", () => {
    const fn = csvFilename("orders", "today");
    expect(fn).toMatch(/^orders_today_\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
