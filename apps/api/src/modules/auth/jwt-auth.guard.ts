import { ExecutionContext, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiException } from "../../common/errors/api.exception";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  handleRequest<T = unknown>(err: unknown, user: T): T {
    if (err || !user) throw ApiException.unauth();
    return user;
  }

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
