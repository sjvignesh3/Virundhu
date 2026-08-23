import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import type { AuthLoginResponse, LoginInput } from "@cartsas/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { ApiException } from "../../common/errors/api.exception";
import { API_ERROR_CODES } from "@cartsas/shared";
import { HttpStatus } from "@nestjs/common";
import { toStoreMembershipDTO, toUserDTO } from "../../common/mappers/entities";

export interface JwtPayload {
  sub: string; // user id
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(input: LoginInput): Promise<AuthLoginResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      include: {
        memberships: { include: { store: true } },
      },
    });
    if (!user || !user.isActive) throw this.invalidCreds();

    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) throw this.invalidCreds();

    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = await this.jwt.signAsync(payload);

    return {
      accessToken,
      user: toUserDTO(user),
      memberships: user.memberships.map(toStoreMembershipDTO),
    };
  }

  async requireUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || !user.isActive) throw ApiException.unauth();
    return user;
  }

  private invalidCreds(): ApiException {
    return new ApiException(
      API_ERROR_CODES.INVALID_CREDENTIALS,
      "Invalid email or password",
      HttpStatus.UNAUTHORIZED,
    );
  }
}
