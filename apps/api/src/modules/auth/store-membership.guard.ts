import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { ApiException } from "../../common/errors/api.exception";
import type { AuthUser } from "./current-user.decorator";

/**
 * Verifies the authenticated user belongs to the store in the URL. Must run
 * after JwtAuthGuard. Attaches `req.storeMembership` so services can read the
 * user's role without a second DB round-trip.
 */
@Injectable()
export class StoreMembershipGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<{
      user?: AuthUser;
      params: Record<string, string>;
      storeMembership?: { storeId: string; role: string };
    }>();

    const user = req.user;
    if (!user) throw ApiException.unauth();

    const storeId = req.params.storeId;
    if (!storeId) throw ApiException.forbidden("Missing storeId");

    const membership = await this.prisma.storeUser.findUnique({
      where: { storeId_userId: { storeId, userId: user.id } },
    });
    if (!membership) throw ApiException.forbidden("You are not a member of this store");

    req.storeMembership = { storeId, role: membership.role };
    return true;
  }
}
