import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  publicCreateOrderSchema,
  type PublicCreateOrderInput,
} from "@virundhu/shared";
import { PublicService } from "./public.service";
import { OrdersService } from "../orders/orders.service";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";

@ApiTags("public")
@Controller("public")
export class PublicController {
  constructor(
    private readonly publicSvc: PublicService,
    private readonly orders: OrdersService,
  ) {}

  @Get("stores/:slug")
  @ApiOperation({ summary: "Get public store info by slug." })
  async getStore(@Param("slug") slug: string) {
    const { store } = await this.publicSvc.getStoreBySlug(slug);
    return store;
  }

  @Get("stores/:slug/categories")
  listCategories(@Param("slug") slug: string) {
    return this.publicSvc.listPublicCategories(slug);
  }

  @Get("stores/:slug/products")
  listProducts(
    @Param("slug") slug: string,
    @Query("includeUnavailable") includeUnavailable?: string,
  ) {
    return this.publicSvc.listPublicProducts(slug, {
      includeUnavailable: includeUnavailable === "true",
    });
  }

  @Post("stores/:slug/orders")
  @ApiOperation({ summary: "Customer checkout. Creates order + payment atomically." })
  async createOrder(
    @Param("slug") slug: string,
    @Body(new ZodValidationPipe(publicCreateOrderSchema)) input: PublicCreateOrderInput,
  ) {
    const storeId = await this.publicSvc.resolveStoreId(slug);
    return this.orders.createFromPublic(storeId, input);
  }

  @Get("stores/:slug/orders/:orderNumber")
  @ApiOperation({ summary: "Customer receipt lookup by order number." })
  getOrder(@Param("slug") slug: string, @Param("orderNumber") orderNumber: string) {
    return this.publicSvc.getPublicOrder(slug, orderNumber);
  }
}
