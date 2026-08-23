import { Module } from "@nestjs/common";
import { OrdersModule } from "../orders/orders.module";
import { PublicController } from "./public.controller";
import { PublicService } from "./public.service";

/**
 * Unauthenticated customer-facing endpoints. Exposes only the minimum data
 * required to render the ordering page and place an order.
 */
@Module({
  imports: [OrdersModule],
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}
