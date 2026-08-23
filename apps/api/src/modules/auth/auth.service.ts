import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import type { AuthLoginResponse, LoginInput, SignupInput } from "@cartsas/shared";
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

  /**
   * Owner self-signup. Creates the User, Store, StoreUser (OWNER role),
   * StoreSettings, and OrderSequence rows in a single transaction so partial
   * state is impossible. No dummy categories/products/orders are created —
   * new tenants start with an empty catalog.
   *
   * Uniqueness violations (email or slug) are caught and rewrapped as
   * CONFLICT errors so the frontend can highlight the offending field.
   */
  async signup(input: SignupInput): Promise<AuthLoginResponse> {
    // Fail fast with a friendly message instead of a low-level DB error.
    const [existingUser, existingStore] = await Promise.all([
      this.prisma.user.findUnique({ where: { email: input.email } }),
      this.prisma.store.findUnique({ where: { slug: input.storeSlug } }),
    ]);
    if (existingUser) {
      throw ApiException.conflict("An account with this email already exists", {
        field: "email",
      });
    }
    if (existingStore) {
      throw ApiException.conflict("This store URL is already taken", {
        field: "storeSlug",
      });
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: input.name,
            email: input.email,
            phone: input.phone,
            passwordHash,
            isActive: true,
          },
        });

        const store = await tx.store.create({
          data: {
            slug: input.storeSlug,
            name: input.storeName,
            tamilName: input.storeTamilName,
            description: input.storeDescription,
            phone: input.storePhone,
            address: input.storeAddress,
            status: "OPEN",
          },
        });

        await tx.storeUser.create({
          data: {
            storeId: store.id,
            userId: user.id,
            role: "OWNER",
          },
        });

        await tx.storeSettings.create({
          data: {
            storeId: store.id,
            // Sensible defaults — owner can tweak from Settings page later.
            defaultLanguage: "en",
            showTamilNames: true,
            showUnavailable: false,
            acceptOrders: true,
            minimumOrderValue: new Prisma.Decimal(0),
            estimatedPreparationMinutes: 15,
          },
        });

        await tx.orderSequence.create({
          data: { storeId: store.id, nextValue: 1 },
        });

        // Re-read the user with memberships so the response mirrors /auth/login.
        return tx.user.findUniqueOrThrow({
          where: { id: user.id },
          include: { memberships: { include: { store: true } } },
        });
      });

      const payload: JwtPayload = { sub: created.id, email: created.email };
      const accessToken = await this.jwt.signAsync(payload);

      return {
        accessToken,
        user: toUserDTO(created),
        memberships: created.memberships.map(toStoreMembershipDTO),
      };
    } catch (err) {
      // Rare race: the pre-checks above passed but a concurrent request created
      // the same email/slug before our transaction committed. Prisma surfaces
      // this as P2002 on the unique index.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const target = (err.meta as { target?: string[] } | undefined)?.target ?? [];
        if (target.includes("email")) {
          throw ApiException.conflict("An account with this email already exists", {
            field: "email",
          });
        }
        if (target.includes("slug")) {
          throw ApiException.conflict("This store URL is already taken", {
            field: "storeSlug",
          });
        }
        throw ApiException.conflict("A record with these values already exists");
      }
      throw err;
    }
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
