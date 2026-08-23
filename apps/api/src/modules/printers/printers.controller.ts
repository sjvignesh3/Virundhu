import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  createPrinterSchema,
  updatePrinterSchema,
  type CreatePrinterInput,
  type UpdatePrinterInput,
} from "@cartsas/shared";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { StoreMembershipGuard } from "../auth/store-membership.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { PrintersService } from "./printers.service";

@ApiTags("printers")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, StoreMembershipGuard)
@Controller("stores/:storeId/printers")
export class PrintersController {
  constructor(private readonly printers: PrintersService) {}

  @Get()
  list(@Param("storeId") storeId: string) {
    return this.printers.list(storeId);
  }

  @Post()
  create(
    @Param("storeId") storeId: string,
    @Body(new ZodValidationPipe(createPrinterSchema)) input: CreatePrinterInput,
  ) {
    return this.printers.create(storeId, input);
  }

  @Patch(":printerId")
  update(
    @Param("storeId") storeId: string,
    @Param("printerId") printerId: string,
    @Body(new ZodValidationPipe(updatePrinterSchema)) input: UpdatePrinterInput,
  ) {
    return this.printers.update(storeId, printerId, input);
  }

  @Delete(":printerId")
  remove(@Param("storeId") storeId: string, @Param("printerId") printerId: string) {
    return this.printers.remove(storeId, printerId);
  }
}
