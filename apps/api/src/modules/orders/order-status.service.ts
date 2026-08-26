import { Injectable } from "@nestjs/common";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { OrderStatus } from "@virundhu/shared";
import { canTransition, nextValidStatuses } from "@virundhu/shared";
import { ApiException } from "../../common/errors/api.exception";
import { PrismaService } from "../../prisma/prisma.service";
import { toOrderDTO } from "../../common/mappers/entities";

export type TxClient = Prisma.TransactionClient | PrismaClient;

/**
 * The single authority on order status transitions. Every mutation goes
 * through `.transition(...)`; controllers never bypass it. Writes are
 * transactional: update + history row together.
 */
@Injectable()
export class OrderStatusService {
  constructor(private readonly prisma: PrismaService) {}

  canMove(from: OrderStatus, to: OrderStatus): boolean {
    return canTransition(from, to);
  }

  validMoves(from: OrderStatus): readonly OrderStatus[] {
    return nextValidStatuses(from);
  }

  async transition(params: {
    storeId: string;
    orderId: string;
    to: OrderStatus;
    userId?: string | null;
    note?: string | null;
  }) {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: params.orderId, storeId: params.storeId },
      });
      if (!order) throw ApiException.notFound("Order", params.orderId);
      const from = order.status as OrderStatus;
      if (!canTransition(from, params.to)) {
        throw ApiException.invalidTransition(from, params.to);
      }
      const updated = await tx.order.update({
        where: { id: params.orderId },
        data: {
          status: params.to,
          ...(params.to === "COMPLETED" && { completedAt: now }),
          ...(params.to === "CANCELLED" && { cancelledAt: now }),
        },
        include: { items: true, customer: true },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId: params.orderId,
          fromStatus: from,
          toStatus: params.to,
          changedByUserId: params.userId ?? null,
          note: params.note ?? null,
        },
      });
      return toOrderDTO(updated);
    });
  }
}
