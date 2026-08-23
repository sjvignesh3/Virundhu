import { Injectable } from "@nestjs/common";
import type { OrderStatus, ReportsSummaryDTO } from "@cartsas/shared";
import { ORDER_STATUSES } from "@cartsas/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { decimalToNumber } from "../../common/mappers/decimal";

export interface ReportsRangeQuery {
  from?: string; // ISO
  to?: string; // ISO
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(storeId: string, q: ReportsRangeQuery): Promise<ReportsSummaryDTO> {
    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setHours(0, 0, 0, 0);

    const from = q.from ? new Date(q.from) : defaultFrom;
    const to = q.to ? new Date(q.to) : now;

    const [orders, aggAll, completedCount, cancelledCount, statuses] = await Promise.all([
      this.prisma.order.count({
        where: { storeId, createdAt: { gte: from, lte: to } },
      }),
      this.prisma.order.aggregate({
        where: { storeId, status: "COMPLETED", completedAt: { gte: from, lte: to } },
        _sum: { totalAmount: true },
        _count: true,
      }),
      this.prisma.order.count({
        where: { storeId, status: "COMPLETED", completedAt: { gte: from, lte: to } },
      }),
      this.prisma.order.count({
        where: { storeId, status: "CANCELLED", cancelledAt: { gte: from, lte: to } },
      }),
      this.prisma.order.groupBy({
        by: ["status"],
        where: { storeId, createdAt: { gte: from, lte: to } },
        _count: true,
      }),
    ]);

    const revenue = decimalToNumber(aggAll._sum.totalAmount ?? 0);
    const completed = aggAll._count ?? 0;
    const averageOrderValue = completed > 0 ? revenue / completed : 0;

    const statusBreakdown = ORDER_STATUSES.reduce(
      (acc, s) => {
        acc[s] = 0;
        return acc;
      },
      {} as Record<OrderStatus, number>,
    );
    for (const row of statuses) {
      statusBreakdown[row.status as OrderStatus] = row._count;
    }

    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      ordersCount: orders,
      completedCount,
      cancelledCount,
      revenue,
      averageOrderValue,
      statusBreakdown,
    };
  }
}
