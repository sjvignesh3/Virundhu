import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { OrderStatus } from "@cartsas/shared";
import {
  orderListQuerySchema,
  orderTransitionSchema,
  type OrderListQuery,
  type OrderTransitionInput,
} from "@cartsas/shared";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { StoreMembershipGuard } from "../auth/store-membership.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { OrdersService } from "./orders.service";
import { OrderStatusService } from "./order-status.service";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator";

@ApiTags("orders")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, StoreMembershipGuard)
@Controller("stores/:storeId/orders")
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly status: OrderStatusService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Paginated order list (history)." })
  list(
    @Param("storeId") storeId: string,
    @Query(new ZodValidationPipe(orderListQuerySchema)) query: OrderListQuery,
  ) {
    return this.orders.list(storeId, query);
  }

  @Get("active")
  @ApiOperation({ summary: "Active orders for the live board (NEW/ACCEPTED/PREPARING/READY)." })
  listActive(@Param("storeId") storeId: string) {
    return this.orders.listActive(storeId);
  }

  @Get(":orderId")
  get(@Param("storeId") storeId: string, @Param("orderId") orderId: string) {
    return this.orders.get(storeId, orderId);
  }

  @Get(":orderId/history")
  history(@Param("storeId") storeId: string, @Param("orderId") orderId: string) {
    return this.orders.statusHistory(storeId, orderId);
  }

  @Post(":orderId/accept")
  accept(
    @Param("storeId") storeId: string,
    @Param("orderId") orderId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(orderTransitionSchema)) body: OrderTransitionInput,
  ) {
    return this.transition(storeId, orderId, "ACCEPTED", user.id, body?.note);
  }

  @Post(":orderId/prepare")
  prepare(
    @Param("storeId") storeId: string,
    @Param("orderId") orderId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(orderTransitionSchema)) body: OrderTransitionInput,
  ) {
    return this.transition(storeId, orderId, "PREPARING", user.id, body?.note);
  }

  @Post(":orderId/ready")
  ready(
    @Param("storeId") storeId: string,
    @Param("orderId") orderId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(orderTransitionSchema)) body: OrderTransitionInput,
  ) {
    return this.transition(storeId, orderId, "READY", user.id, body?.note);
  }

  @Post(":orderId/complete")
  complete(
    @Param("storeId") storeId: string,
    @Param("orderId") orderId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(orderTransitionSchema)) body: OrderTransitionInput,
  ) {
    return this.transition(storeId, orderId, "COMPLETED", user.id, body?.note);
  }

  @Post(":orderId/cancel")
  cancel(
    @Param("storeId") storeId: string,
    @Param("orderId") orderId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(orderTransitionSchema)) body: OrderTransitionInput,
  ) {
    return this.transition(storeId, orderId, "CANCELLED", user.id, body?.note);
  }

  private transition(
    storeId: string,
    orderId: string,
    to: OrderStatus,
    userId: string,
    note?: string | null,
  ) {
    return this.status.transition({ storeId, orderId, to, userId, note });
  }
}
