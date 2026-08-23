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
  createCategorySchema,
  updateCategorySchema,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from "@cartsas/shared";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { StoreMembershipGuard } from "../auth/store-membership.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CategoriesService } from "./categories.service";

@ApiTags("categories")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, StoreMembershipGuard)
@Controller("stores/:storeId/categories")
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: "List categories for a store." })
  list(
    @Param("storeId") storeId: string,
    @Query("includeInactive") includeInactive?: string,
  ) {
    return this.categories.list(storeId, includeInactive === "true");
  }

  @Get(":categoryId")
  get(@Param("storeId") storeId: string, @Param("categoryId") categoryId: string) {
    return this.categories.get(storeId, categoryId);
  }

  @Post()
  create(
    @Param("storeId") storeId: string,
    @Body(new ZodValidationPipe(createCategorySchema)) input: CreateCategoryInput,
  ) {
    return this.categories.create(storeId, input);
  }

  @Patch(":categoryId")
  update(
    @Param("storeId") storeId: string,
    @Param("categoryId") categoryId: string,
    @Body(new ZodValidationPipe(updateCategorySchema)) input: UpdateCategoryInput,
  ) {
    return this.categories.update(storeId, categoryId, input);
  }

  @Delete(":categoryId")
  remove(@Param("storeId") storeId: string, @Param("categoryId") categoryId: string) {
    return this.categories.remove(storeId, categoryId);
  }
}
