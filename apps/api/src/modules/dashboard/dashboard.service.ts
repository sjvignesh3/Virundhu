import { Injectable } from "@nestjs/common";
import type { DashboardMetricsDTO } from "@virundhu/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { decimalToNumber } from "../../common/mappers/decimal";

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async metrics(storeId: string): Promise<DashboardMetricsDTO> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
      ordersToday,
      completedToday,
      activeOrders,
      revenueAgg,
      totalProducts,
      availableProducts,
      products,
      categoryCount,
      topItemsRaw,
    ] = await Promise.all([
      this.prisma.order.count({
        where: { storeId, createdAt: { gte: startOfDay } },
      }),
      this.prisma.order.count({
        where: { storeId, status: "COMPLETED", completedAt: { gte: startOfDay } },
      }),
      this.prisma.order.count({
        where: { storeId, status: { in: ["NEW", "ACCEPTED", "PREPARING", "READY"] } },
      }),
      this.prisma.order.aggregate({
        where: { storeId, status: "COMPLETED", completedAt: { gte: startOfDay } },
        _sum: { totalAmount: true },
      }),
      this.prisma.product.count({ where: { storeId } }),
      this.prisma.product.count({ where: { storeId, isAvailable: true } }),
      this.prisma.product.findMany({
        where: { storeId, stockQuantity: { not: null } },
        select: { id: true, stockQuantity: true, lowStockThreshold: true },
      }),
      this.prisma.category.count({ where: { storeId, isActive: true } }),
      this.prisma.orderItem.groupBy({
        by: ["productId", "productName"],
        where: {
          order: { storeId, status: "COMPLETED", completedAt: { gte: startOfDay } },
        },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
      }),
    ]);

    let lowStockCount = 0;
    let outOfStockCount = 0;
    for (const p of products) {
      const stock = p.stockQuantity ? decimalToNumber(p.stockQuantity) : null;
      if (stock === null) continue;
      if (stock <= 0) {
        outOfStockCount += 1;
      } else if (p.lowStockThreshold) {
        const th = decimalToNumber(p.lowStockThreshold);
        if (stock <= th) lowStockCount += 1;
      }
    }

    return {
      ordersToday,
      completedToday,
      activeOrders,
      revenueToday: decimalToNumber(revenueAgg._sum.totalAmount ?? 0),
      totalProducts,
      availableProducts,
      lowStockCount,
      outOfStockCount,
      categoryCount,
      topItems: topItemsRaw.map((t) => ({
        productId: t.productId,
        name: t.productName,
        quantity: decimalToNumber(t._sum.quantity ?? 0),
      })),
    };
  }
}
