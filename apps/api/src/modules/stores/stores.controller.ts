import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  updateStoreSchema,
  updateStoreSettingsSchema,
  type UpdateStoreInput,
  type UpdateStoreSettingsInput,
} from "@cartsas/shared";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { StoreMembershipGuard } from "../auth/store-membership.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { StoresService } from "./stores.service";

@ApiTags("stores")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, StoreMembershipGuard)
@Controller("stores/:storeId")
export class StoresController {
  constructor(private readonly stores: StoresService) {}

  @Get()
  @ApiOperation({ summary: "Get store details (owner view)." })
  get(@Param("storeId") storeId: string) {
    return this.stores.get(storeId);
  }

  @Patch()
  @ApiOperation({ summary: "Update store details." })
  update(
    @Param("storeId") storeId: string,
    @Body(new ZodValidationPipe(updateStoreSchema)) input: UpdateStoreInput,
  ) {
    return this.stores.update(storeId, input);
  }

  @Get("settings")
  @ApiOperation({ summary: "Get store settings." })
  getSettings(@Param("storeId") storeId: string) {
    return this.stores.getSettings(storeId);
  }

  @Patch("settings")
  @ApiOperation({ summary: "Update store settings." })
  updateSettings(
    @Param("storeId") storeId: string,
    @Body(new ZodValidationPipe(updateStoreSettingsSchema))
    input: UpdateStoreSettingsInput,
  ) {
    return this.stores.updateSettings(storeId, input);
  }
}
