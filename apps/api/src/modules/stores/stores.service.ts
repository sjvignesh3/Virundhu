import { Injectable } from "@nestjs/common";
import type { UpdateStoreInput, UpdateStoreSettingsInput } from "@virundhu/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { ApiException } from "../../common/errors/api.exception";
import {
  toStoreDTO,
  toStoreSettingsDTO,
} from "../../common/mappers/entities";
import { toPrismaDecimal } from "../../common/mappers/decimal";

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  async get(storeId: string) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw ApiException.notFound("Store", storeId);
    return toStoreDTO(store);
  }

  async update(storeId: string, patch: UpdateStoreInput) {
    await this.get(storeId); // 404-check
    const updated = await this.prisma.store.update({
      where: { id: storeId },
      data: {
        ...(patch.slug !== undefined && { slug: patch.slug }),
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.tamilName !== undefined && { tamilName: patch.tamilName ?? null }),
        ...(patch.description !== undefined && { description: patch.description ?? null }),
        ...(patch.phone !== undefined && { phone: patch.phone ?? null }),
        ...(patch.address !== undefined && { address: patch.address ?? null }),
        ...(patch.logoUrl !== undefined && { logoUrl: patch.logoUrl ?? null }),
        ...(patch.imageUrl !== undefined && { imageUrl: patch.imageUrl ?? null }),
        ...(patch.status !== undefined && { status: patch.status }),
      },
    });
    return toStoreDTO(updated);
  }

  async getSettings(storeId: string) {
    const settings = await this.prisma.storeSettings.upsert({
      where: { storeId },
      update: {},
      create: { storeId },
    });
    return toStoreSettingsDTO(settings);
  }

  async updateSettings(storeId: string, patch: UpdateStoreSettingsInput) {
    const settings = await this.prisma.storeSettings.upsert({
      where: { storeId },
      update: {
        ...(patch.defaultLanguage !== undefined && { defaultLanguage: patch.defaultLanguage }),
        ...(patch.showTamilNames !== undefined && { showTamilNames: patch.showTamilNames }),
        ...(patch.showUnavailable !== undefined && { showUnavailable: patch.showUnavailable }),
        ...(patch.acceptOrders !== undefined && { acceptOrders: patch.acceptOrders }),
        ...(patch.minimumOrderValue !== undefined && {
          minimumOrderValue: toPrismaDecimal(patch.minimumOrderValue),
        }),
        ...(patch.estimatedPreparationMinutes !== undefined && {
          estimatedPreparationMinutes: patch.estimatedPreparationMinutes,
        }),
      },
      create: {
        storeId,
        defaultLanguage: patch.defaultLanguage ?? "en",
        showTamilNames: patch.showTamilNames ?? true,
        showUnavailable: patch.showUnavailable ?? false,
        acceptOrders: patch.acceptOrders ?? true,
        minimumOrderValue: toPrismaDecimal(patch.minimumOrderValue ?? 0),
        estimatedPreparationMinutes: patch.estimatedPreparationMinutes ?? 15,
      },
    });
    return toStoreSettingsDTO(settings);
  }
}
