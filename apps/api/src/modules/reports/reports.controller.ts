import { Controller, Get, Header, Param, Query, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { StoreMembershipGuard } from "../auth/store-membership.guard";
import { ReportsService } from "./reports.service";
import { OrdersService } from "../orders/orders.service";

@ApiTags("reports")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, StoreMembershipGuard)
@Controller("stores/:storeId/reports")
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly orders: OrdersService,
  ) {}

  @Get()
  summary(
    @Param("storeId") storeId: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.reports.summary(storeId, { from, to });
  }

  @Get("orders.csv")
  @ApiOperation({ summary: "CSV export of orders in a date range." })
  @Header("Content-Type", "text/csv; charset=utf-8")
  async csv(
    @Param("storeId") storeId: string,
    @Res() res: Response,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("status") status?: string,
  ) {
    const orders = await this.orders.listAll(storeId, {
      from,
      to,
      status: status ? (status.split(",") as any) : undefined,
    });

    const headerCols = [
      "Order Number",
      "Customer",
      "Phone",
      "Items",
      "Total",
      "Payment Status",
      "Order Status",
      "Created",
      "Completed",
    ];

    const escape = (v: unknown): string => {
      const s = v === null || v === undefined ? "" : String(v);
      if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const rows = orders.map((o) =>
      [
        o.orderNumber,
        o.customer?.name ?? "",
        o.customer?.phone ?? "",
        o.items.map((i) => `${i.productName} x${i.quantity}`).join("; "),
        o.totalAmount.toFixed(2),
        o.paymentStatus,
        o.status,
        o.createdAt,
        o.completedAt ?? "",
      ]
        .map(escape)
        .join(","),
    );

    // UTF-8 BOM so Excel opens Tamil + ₹ correctly.
    const body = "\uFEFF" + [headerCols.join(","), ...rows].join("\r\n");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    res.send(body);
  }
}
