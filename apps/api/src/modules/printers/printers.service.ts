import { Injectable } from "@nestjs/common";
import type { CreatePrinterInput, UpdatePrinterInput } from "@virundhu/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { ApiException } from "../../common/errors/api.exception";
import { toPrinterDTO } from "../../common/mappers/entities";

@Injectable()
export class PrintersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(storeId: string) {
    const rows = await this.prisma.printer.findMany({
      where: { storeId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toPrinterDTO);
  }

  async get(storeId: string, printerId: string) {
    const row = await this.prisma.printer.findFirst({
      where: { id: printerId, storeId },
    });
    if (!row) throw ApiException.notFound("Printer", printerId);
    return toPrinterDTO(row);
  }

  async create(storeId: string, input: CreatePrinterInput) {
    const row = await this.prisma.printer.create({
      data: {
        storeId,
        name: input.name,
        type: input.type,
        address: input.address ?? null,
        isActive: input.isActive ?? true,
        connectionStatus: input.connectionStatus ?? "UNKNOWN",
      },
    });
    return toPrinterDTO(row);
  }

  async update(storeId: string, printerId: string, patch: UpdatePrinterInput) {
    await this.get(storeId, printerId);
    const row = await this.prisma.printer.update({
      where: { id: printerId },
      data: {
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.type !== undefined && { type: patch.type }),
        ...(patch.address !== undefined && { address: patch.address ?? null }),
        ...(patch.isActive !== undefined && { isActive: patch.isActive }),
        ...(patch.connectionStatus !== undefined && {
          connectionStatus: patch.connectionStatus,
        }),
      },
    });
    return toPrinterDTO(row);
  }

  async remove(storeId: string, printerId: string) {
    await this.get(storeId, printerId);
    // Soft-delete: keep row for historical reports referencing this printer.
    const row = await this.prisma.printer.update({
      where: { id: printerId },
      data: { isActive: false },
    });
    return toPrinterDTO(row);
  }
}
