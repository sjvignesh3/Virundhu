import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { formatOrderNumber } from "@cartsas/shared";

/**
 * Race-safe per-store sequence. Uses an `OrderSequence` row updated inside
 * the same transaction as order creation, so two concurrent checkouts can
 * never produce the same FC-XXXX number (the update itself takes a row
 * lock in Postgres; SQLite serialises all writes anyway).
 */
@Injectable()
export class OrderNumberService {
  async nextOrderNumber(tx: Prisma.TransactionClient, storeId: string): Promise<string> {
    const seq = await tx.orderSequence.upsert({
      where: { storeId },
      update: { nextValue: { increment: 1 } },
      create: { storeId, nextValue: 2 },
    });
    // We just incremented; the value _before_ this increment is what we assign.
    const assigned = seq.nextValue - 1;
    return formatOrderNumber(assigned);
  }
}
