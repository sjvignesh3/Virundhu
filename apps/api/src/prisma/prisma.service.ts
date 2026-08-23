import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      // Render free tier runs a single process; Supabase Serverless pooler
      // (pgBouncer, transaction mode) limits concurrent server-side connections.
      // Keep the Prisma pool small so we never exhaust the pooler's slots.
      // connection_limit=3  → at most 3 physical Postgres connections per pod
      // pool_timeout=15     → wait up to 15 s for a free slot before P2024
      log: process.env.NODE_ENV === "development"
        ? [{ emit: "stdout", level: "query" }, { emit: "stdout", level: "warn" }]
        : [{ emit: "stdout", level: "warn" }],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log("Prisma connected");
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
