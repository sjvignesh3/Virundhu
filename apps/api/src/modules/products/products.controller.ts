import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  createProductSchema,
  setProductAvailabilitySchema,
  updateProductSchema,
  type CreateProductInput,
  type UpdateProductInput,
} from "@cartsas/shared";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { StoreMembershipGuard } from "../auth/store-membership.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { ProductsService } from "./products.service";

@ApiTags("products")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, StoreMembershipGuard)
@Controller("stores/:storeId/products")
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(
    @Param("storeId") storeId: string,
    @Query("categoryId") categoryId?: string,
    @Query("availableOnly") availableOnly?: string,
    @Query("search") search?: string,
  ) {
    return this.products.list(storeId, {
      categoryId,
      availableOnly: availableOnly === "true",
      search,
    });
  }

  @Get(":productId")
  get(@Param("storeId") storeId: string, @Param("productId") productId: string) {
    return this.products.get(storeId, productId);
  }

  @Post()
  create(
    @Param("storeId") storeId: string,
    @Body(new ZodValidationPipe(createProductSchema)) input: CreateProductInput,
  ) {
    return this.products.create(storeId, input);
  }

  @Patch(":productId")
  update(
    @Param("storeId") storeId: string,
    @Param("productId") productId: string,
    @Body(new ZodValidationPipe(updateProductSchema)) input: UpdateProductInput,
  ) {
    return this.products.update(storeId, productId, input);
  }

  @Patch(":productId/availability")
  @ApiOperation({ summary: "Toggle product availability." })
  setAvailability(
    @Param("storeId") storeId: string,
    @Param("productId") productId: string,
    @Body(new ZodValidationPipe(setProductAvailabilitySchema))
    input: { isAvailable: boolean },
  ) {
    return this.products.setAvailability(storeId, productId, input.isAvailable);
  }

  @Delete(":productId")
  remove(@Param("storeId") storeId: string, @Param("productId") productId: string) {
    return this.products.remove(storeId, productId);
  }
}
