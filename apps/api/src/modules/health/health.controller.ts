import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Lightweight liveness + readiness endpoints for hosting platforms.
 * Render (and most PaaS providers) poll a HTTP path to decide whether an
 * instance is healthy. Keeping this outside auth means the platform can
 * probe without credentials.
 */
@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Cheap process-alive check — used by Render's health check. */
  @Get()
  live() {
    return { status: "ok", uptime: process.uptime() };
  }

  /** DB-connectivity check — call after deploy to confirm migrations landed. */
  @Get("ready")
  async ready() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: "ok", db: "reachable" };
  }
}
