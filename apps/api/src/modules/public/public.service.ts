import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { ApiException } from "../../common/errors/api.exception";
import {
  toCategoryDTO,
  toOrderDTO,
  toProductDTO,
  toPublicStoreDTO,
} from "../../common/mappers/entities";
import { toPrismaDecimal } from "../../common/mappers/decimal";

@Injectable()
export class PublicService {
  constructor(private readonly prisma: PrismaService) {}

  async getStoreBySlug(slug: string) {
    const store = await this.prisma.store.findUnique({
      where: { slug },
      include: { settings: true },
    });
    if (!store) throw ApiException.notFound("Store", slug);
    // Auto-provision settings row (public read should never 500).
    const settings =
      store.settings ??
      (await this.prisma.storeSettings.create({
        data: {
          storeId: store.id,
          minimumOrderValue: toPrismaDecimal(0),
        },
      }));
    return { store: toPublicStoreDTO(store, settings), _id: store.id };
  }

  async listPublicCategories(slug: string) {
    const { _id } = await this.getStoreBySlug(slug);
    const rows = await this.prisma.category.findMany({
      where: { storeId: _id, isActive: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });
    return rows.map(toCategoryDTO);
  }

  async listPublicProducts(slug: string, opts: { includeUnavailable?: boolean } = {}) {
    const { _id } = await this.getStoreBySlug(slug);
    const rows = await this.prisma.product.findMany({
      where: {
        storeId: _id,
        ...(opts.includeUnavailable ? {} : { isAvailable: true }),
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });
    return rows.map(toProductDTO);
  }

  async getPublicOrder(slug: string, orderNumber: string) {
    const { _id } = await this.getStoreBySlug(slug);
    const row = await this.prisma.order.findUnique({
      where: { storeId_orderNumber: { storeId: _id, orderNumber } },
      include: { items: true, customer: true },
    });
    if (!row) throw ApiException.notFound("Order", orderNumber);
    // Strip customer PII from public read except what is needed for confirmation.
    return toOrderDTO(row);
  }

  async resolveStoreId(slug: string): Promise<string> {
    const store = await this.prisma.store.findUnique({ where: { slug } });
    if (!store) throw ApiException.notFound("Store", slug);
    return store.id;
  }
}
