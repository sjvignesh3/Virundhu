import { Injectable } from "@nestjs/common";
import type { CreateProductInput, UpdateProductInput } from "@virundhu/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { ApiException } from "../../common/errors/api.exception";
import { toProductDTO } from "../../common/mappers/entities";
import { toPrismaDecimal } from "../../common/mappers/decimal";

export interface ProductListFilter {
  categoryId?: string;
  availableOnly?: boolean;
  search?: string;
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(storeId: string, filter: ProductListFilter = {}) {
    const rows = await this.prisma.product.findMany({
      where: {
        storeId,
        ...(filter.categoryId && { categoryId: filter.categoryId }),
        ...(filter.availableOnly && { isAvailable: true }),
        ...(filter.search && {
          OR: [
            { name: { contains: filter.search } },
            { tamilName: { contains: filter.search } },
          ],
        }),
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });
    return rows.map(toProductDTO);
  }

  async get(storeId: string, productId: string) {
    const row = await this.prisma.product.findFirst({
      where: { id: productId, storeId },
    });
    if (!row) throw ApiException.notFound("Product", productId);
    return toProductDTO(row);
  }

  async create(storeId: string, input: CreateProductInput) {
    // Enforce tenant isolation: category must belong to same store (§11).
    await this.assertCategoryBelongsToStore(storeId, input.categoryId);

    const row = await this.prisma.product.create({
      data: {
        storeId,
        categoryId: input.categoryId,
        name: input.name,
        tamilName: input.tamilName ?? null,
        description: input.description ?? null,
        tamilDescription: input.tamilDescription ?? null,
        price: toPrismaDecimal(input.price),
        unit: input.unit,
        imageUrl: input.imageUrl ?? null,
        isAvailable: input.isAvailable ?? true,
        stockQuantity:
          input.stockQuantity !== undefined && input.stockQuantity !== null
            ? toPrismaDecimal(input.stockQuantity)
            : null,
        lowStockThreshold:
          input.lowStockThreshold !== undefined && input.lowStockThreshold !== null
            ? toPrismaDecimal(input.lowStockThreshold)
            : null,
        displayOrder: input.displayOrder ?? 0,
      },
    });
    return toProductDTO(row);
  }

  async update(storeId: string, productId: string, patch: UpdateProductInput) {
    await this.get(storeId, productId);

    if (patch.categoryId) {
      await this.assertCategoryBelongsToStore(storeId, patch.categoryId);
    }

    const row = await this.prisma.product.update({
      where: { id: productId },
      data: {
        ...(patch.categoryId !== undefined && { categoryId: patch.categoryId }),
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.tamilName !== undefined && { tamilName: patch.tamilName ?? null }),
        ...(patch.description !== undefined && { description: patch.description ?? null }),
        ...(patch.tamilDescription !== undefined && {
          tamilDescription: patch.tamilDescription ?? null,
        }),
        ...(patch.price !== undefined && { price: toPrismaDecimal(patch.price) }),
        ...(patch.unit !== undefined && { unit: patch.unit }),
        ...(patch.imageUrl !== undefined && { imageUrl: patch.imageUrl ?? null }),
        ...(patch.isAvailable !== undefined && { isAvailable: patch.isAvailable }),
        ...(patch.stockQuantity !== undefined && {
          stockQuantity:
            patch.stockQuantity === null ? null : toPrismaDecimal(patch.stockQuantity),
        }),
        ...(patch.lowStockThreshold !== undefined && {
          lowStockThreshold:
            patch.lowStockThreshold === null ? null : toPrismaDecimal(patch.lowStockThreshold),
        }),
        ...(patch.displayOrder !== undefined && { displayOrder: patch.displayOrder }),
      },
    });
    return toProductDTO(row);
  }

  async setAvailability(storeId: string, productId: string, isAvailable: boolean) {
    await this.get(storeId, productId);
    const row = await this.prisma.product.update({
      where: { id: productId },
      data: { isAvailable },
    });
    return toProductDTO(row);
  }

  /**
   * Soft delete when the product has been ordered before (historical
   * references must not break); hard delete only when zero order items
   * reference it. Matches §40.
   */
  async remove(storeId: string, productId: string) {
    await this.get(storeId, productId);
    const orderCount = await this.prisma.orderItem.count({
      where: { productId },
    });
    if (orderCount > 0) {
      await this.prisma.product.update({
        where: { id: productId },
        data: { isAvailable: false },
      });
      return { success: true, softDeleted: true };
    }
    await this.prisma.product.delete({ where: { id: productId } });
    return { success: true, softDeleted: false };
  }

  private async assertCategoryBelongsToStore(storeId: string, categoryId: string) {
    const cat = await this.prisma.category.findFirst({
      where: { id: categoryId, storeId },
    });
    if (!cat) throw ApiException.crossStore();
  }
}
