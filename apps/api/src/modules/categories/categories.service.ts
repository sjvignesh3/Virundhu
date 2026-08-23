import { Injectable } from "@nestjs/common";
import type { CreateCategoryInput, UpdateCategoryInput } from "@cartsas/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { ApiException } from "../../common/errors/api.exception";
import { toCategoryDTO } from "../../common/mappers/entities";

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(storeId: string, includeInactive = false) {
    const rows = await this.prisma.category.findMany({
      where: { storeId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });
    return rows.map(toCategoryDTO);
  }

  async get(storeId: string, categoryId: string) {
    const row = await this.prisma.category.findFirst({
      where: { id: categoryId, storeId },
    });
    if (!row) throw ApiException.notFound("Category", categoryId);
    return toCategoryDTO(row);
  }

  async create(storeId: string, input: CreateCategoryInput) {
    const row = await this.prisma.category.create({
      data: {
        storeId,
        name: input.name,
        tamilName: input.tamilName ?? null,
        description: input.description ?? null,
        displayOrder: input.displayOrder ?? 0,
        isActive: input.isActive ?? true,
      },
    });
    return toCategoryDTO(row);
  }

  async update(storeId: string, categoryId: string, patch: UpdateCategoryInput) {
    await this.get(storeId, categoryId);
    const row = await this.prisma.category.update({
      where: { id: categoryId },
      data: {
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.tamilName !== undefined && { tamilName: patch.tamilName ?? null }),
        ...(patch.description !== undefined && { description: patch.description ?? null }),
        ...(patch.displayOrder !== undefined && { displayOrder: patch.displayOrder }),
        ...(patch.isActive !== undefined && { isActive: patch.isActive }),
      },
    });
    return toCategoryDTO(row);
  }

  /**
   * Soft delete via `isActive = false` when the category has any products
   * (existing or historical order references). Physical delete only when the
   * category is truly empty. This matches the delete-strategy rule (§40).
   */
  async remove(storeId: string, categoryId: string) {
    await this.get(storeId, categoryId);
    const productCount = await this.prisma.product.count({
      where: { categoryId, storeId },
    });
    if (productCount > 0) {
      throw ApiException.categoryHasProducts();
    }
    await this.prisma.category.delete({ where: { id: categoryId } });
    return { success: true };
  }
}
