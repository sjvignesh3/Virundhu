import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { loginSchema, type LoginInput } from "@cartsas/shared";
import { AuthService } from "./auth.service";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { CurrentUser } from "./current-user.decorator";
import type { AuthUser } from "./current-user.decorator";
import { PrismaService } from "../../prisma/prisma.service";
import { toStoreMembershipDTO, toUserDTO } from "../../common/mappers/entities";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Post("login")
  @ApiOperation({ summary: "Owner/staff login. Returns JWT + user + memberships." })
  async login(@Body(new ZodValidationPipe(loginSchema)) input: LoginInput) {
    return this.auth.login(input);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Returns the current authenticated user + memberships." })
  async me(@CurrentUser() user: AuthUser) {
    const full = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { memberships: { include: { store: true } } },
    });
    return {
      user: toUserDTO(full),
      memberships: full.memberships.map(toStoreMembershipDTO),
    };
  }
}
