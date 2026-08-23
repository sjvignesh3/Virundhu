import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PaymentsModule } from "../payments/payments.module";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { OrderStatusService } from "./order-status.service";
import { OrderNumberService } from "./order-number.service";

@Module({
  imports: [AuthModule, PaymentsModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderStatusService, OrderNumberService],
  exports: [OrdersService, OrderStatusService, OrderNumberService],
})
export class OrdersModule {}
