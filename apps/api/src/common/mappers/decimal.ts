import { Prisma } from "@prisma/client";

/**
 * Prisma returns Decimal columns as `Prisma.Decimal` instances. The API
 * contract exposes them as plain numbers (INR rupees). These helpers centralise
 * the conversion so serialization logic stays in one place.
 */
export function decimalToNumber(v: Prisma.Decimal | number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number.parseFloat(v);
  return Number(v.toString());
}

export function optionalDecimalToNumber(
  v: Prisma.Decimal | number | string | null | undefined,
): number | null {
  if (v === null || v === undefined) return null;
  return decimalToNumber(v);
}

export function toPrismaDecimal(v: number | string): Prisma.Decimal {
  return new Prisma.Decimal(v);
}
