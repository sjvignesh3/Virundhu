import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  loginSchema,
  signupSchema,
  type LoginInput,
  type SignupInput,
} from "@cartsas/shared";
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

  @Post("signup")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      "Owner self-signup. Creates user + empty store + owner membership in one transaction. Returns the same shape as /auth/login so the frontend can sign the user in immediately.",
  })
  async signup(@Body(new ZodValidationPipe(signupSchema)) input: SignupInput) {
    return this.auth.signup(input);
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
