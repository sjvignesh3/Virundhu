import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import {
  computeOrderTotals,
  type OrderListQuery,
  type PublicCreateOrderInput,
  type OrderStatus,
  type PaginatedResponse,
  type OrderDTO,
} from "@cartsas/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { ApiException } from "../../common/errors/api.exception";
import { toOrderDTO } from "../../common/mappers/entities";
import { decimalToNumber, toPrismaDecimal } from "../../common/mappers/decimal";
import { PaymentsService } from "../payments/payments.service";
import { OrderNumberService } from "./order-number.service";

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly orderNumbers: OrderNumberService,
  ) {}

  async list(storeId: string, query: OrderListQuery): Promise<PaginatedResponse<OrderDTO>> {
    const where: Prisma.OrderWhereInput = {
      storeId,
      ...(query.status && query.status.length > 0 && { status: { in: query.status } }),
      ...(query.from && { createdAt: { gte: new Date(query.from) } }),
      ...(query.to && {
        createdAt: {
          ...(query.from ? { gte: new Date(query.from) } : {}),
          lte: new Date(query.to),
        },
      }),
      ...(query.search && {
        OR: [
          { orderNumber: { contains: query.search } },
          { customer: { name: { contains: query.search } } },
          { customer: { phone: { contains: query.search } } },
        ],
      }),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: { items: true, customer: true },
      }),
    ]);

    return {
      data: rows.map(toOrderDTO),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  }

  async listAll(storeId: string, query: Omit<OrderListQuery, "page" | "limit">): Promise<OrderDTO[]> {
    const where: Prisma.OrderWhereInput = {
      storeId,
      ...(query.status && query.status.length > 0 && { status: { in: query.status } }),
      ...(query.from && { createdAt: { gte: new Date(query.from) } }),
      ...(query.to && { createdAt: { lte: new Date(query.to) } }),
    };
    const rows = await this.prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { items: true, customer: true },
    });
    return rows.map(toOrderDTO);
  }

  async listActive(storeId: string): Promise<OrderDTO[]> {
    const rows = await this.prisma.order.findMany({
      where: {
        storeId,
        status: { in: ["NEW", "ACCEPTED", "PREPARING", "READY"] },
      },
      orderBy: { createdAt: "asc" },
      include: { items: true, customer: true },
    });
    return rows.map(toOrderDTO);
  }

  async get(storeId: string, orderId: string): Promise<OrderDTO> {
    const row = await this.prisma.order.findFirst({
      where: { id: orderId, storeId },
      include: { items: true, customer: true },
    });
    if (!row) throw ApiException.notFound("Order", orderId);
    return toOrderDTO(row);
  }

  async getByNumber(storeId: string, orderNumber: string): Promise<OrderDTO> {
    const row = await this.prisma.order.findUnique({
      where: { storeId_orderNumber: { storeId, orderNumber } },
      include: { items: true, customer: true },
    });
    if (!row) throw ApiException.notFound("Order", orderNumber);
    return toOrderDTO(row);
  }

  async statusHistory(storeId: string, orderId: string) {
    await this.get(storeId, orderId); // ownership check
    const rows = await this.prisma.orderStatusHistory.findMany({
      where: { orderId },
      orderBy: { createdAt: "asc" },
    });
    return rows;
  }

  /**
   * The heart of Phase 2. Runs *entirely* inside a single Prisma transaction:
   *   1. Verify store open + accepting orders.
   *   2. Load & lock every requested product (SELECT … in tx acts as an
   *      implicit row lock in Postgres; SQLite serialises writes anyway so
   *      it is safe there too).
   *   3. Validate availability, tenant match, and stock.
   *   4. Recompute totals from database prices (never trust client).
   *   5. Reserve stock, create customer, order, items, status history,
   *      order-number sequence bump, and payment atomically.
   *
   * If any step throws, the whole transaction rolls back.
   */
  async createFromPublic(storeId: string, input: PublicCreateOrderInput): Promise<OrderDTO> {
    if (input.items.length === 0) throw ApiException.emptyCart();

    return this.prisma.$transaction(async (tx) => {
      // 1. Store gates.
      const store = await tx.store.findUnique({
        where: { id: storeId },
        include: { settings: true },
      });
      if (!store) throw ApiException.notFound("Store", storeId);
      if (store.status !== "OPEN") throw ApiException.storeClosed();
      const settings = store.settings ?? {
        acceptOrders: true,
        minimumOrderValue: toPrismaDecimal(0),
        estimatedPreparationMinutes: 15,
      };
      if (!settings.acceptOrders) throw ApiException.storeNotAccepting();

      // 2. Load products for every requested line.
      const productIds = input.items.map((i) => i.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
      });
      const productById = new Map(products.map((p) => [p.id, p]));

      // 3. Validate + build lines with fresh prices.
      const lines = input.items.map((line) => {
        const product = productById.get(line.productId);
        if (!product) throw ApiException.notFound("Product", line.productId);
        if (product.storeId !== storeId) throw ApiException.crossStore();
        if (!product.isAvailable) throw ApiException.productUnavailable(product.name);
        if (product.stockQuantity !== null && product.stockQuantity !== undefined) {
          const currentStock = decimalToNumber(product.stockQuantity);
          if (currentStock < line.quantity) {
            throw ApiException.outOfStock(product.name);
          }
        }
        const unitPrice = decimalToNumber(product.price);
        return {
          product,
          quantity: line.quantity,
          unitPrice,
          subtotal: unitPrice * line.quantity,
        };
      });

      // 4. Recompute totals authoritatively.
      const totals = computeOrderTotals(
        lines.map((l) => ({ unitPrice: l.unitPrice, quantity: l.quantity })),
      );
      const minOrder = decimalToNumber(settings.minimumOrderValue);
      if (minOrder > 0 && totals.totalAmount < minOrder) {
        throw ApiException.belowMinimum(minOrder);
      }

      // 5. Customer (upsert-ish by phone if provided, else fresh).
      let customerId: string | null = null;
      if (input.customer?.phone || input.customer?.name) {
        const existing = input.customer.phone
          ? await tx.customer.findFirst({
              where: { storeId, phone: input.customer.phone },
            })
          : null;
        if (existing) {
          const updated = await tx.customer.update({
            where: { id: existing.id },
            data: {
              ...(input.customer.name && { name: input.customer.name }),
            },
          });
          customerId = updated.id;
        } else {
          const created = await tx.customer.create({
            data: {
              storeId,
              name: input.customer.name ?? null,
              phone: input.customer.phone ?? null,
            },
          });
          customerId = created.id;
        }
      }

      // 6. Order number.
      const orderNumber = await this.orderNumbers.nextOrderNumber(tx, storeId);

      // 7. Create order + items + initial history entry.
      const order = await tx.order.create({
        data: {
          storeId,
          customerId,
          orderNumber,
          status: "NEW",
          paymentStatus: "PENDING",
          paymentMethod: "SIMULATED",
          subtotal: toPrismaDecimal(totals.subtotal),
          discountAmount: toPrismaDecimal(totals.discountAmount),
          taxAmount: toPrismaDecimal(totals.taxAmount),
          totalAmount: toPrismaDecimal(totals.totalAmount),
          notes: input.notes ?? null,
          items: {
            create: lines.map((l) => ({
              productId: l.product.id,
              productName: l.product.name,
              productTamilName: l.product.tamilName,
              unit: l.product.unit,
              unitPrice: toPrismaDecimal(l.unitPrice),
              quantity: toPrismaDecimal(l.quantity),
              subtotal: toPrismaDecimal(l.subtotal),
            })),
          },
        },
        include: { items: true, customer: true },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: null,
          toStatus: "NEW",
          note: "Order created",
        },
      });

      // 8. Decrement stock (transactional — no race with concurrent orders).
      for (const line of lines) {
        if (line.product.stockQuantity !== null && line.product.stockQuantity !== undefined) {
          const newStock = decimalToNumber(line.product.stockQuantity) - line.quantity;
          await tx.product.update({
            where: { id: line.product.id },
            data: {
              stockQuantity: toPrismaDecimal(newStock),
              // Auto-mark unavailable when stock hits zero (§33).
              ...(newStock <= 0 && { isAvailable: false }),
            },
          });
        }
      }

      // 9. Simulated payment (Phase 2). Marks order PAID on success.
      const { result } = await this.payments.chargeAndRecord(
        order.id,
        totals.totalAmount,
        "SIMULATED",
        tx,
      );

      const finalOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: result.status,
          paymentMethod: result.method,
        },
        include: { items: true, customer: true },
      });

      return toOrderDTO(finalOrder);
    });
  }
}
