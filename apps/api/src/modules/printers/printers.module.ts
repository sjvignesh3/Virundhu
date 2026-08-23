import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrintersController } from "./printers.controller";
import { PrintersService } from "./printers.service";

@Module({
  imports: [AuthModule],
  controllers: [PrintersController],
  providers: [PrintersService],
})
export class PrintersModule {}
