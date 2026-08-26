import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { CategoriesService } from "./categories.service";
import { ApiException } from "../../common/errors/api.exception";
import { API_ERROR_CODES } from "@virundhu/shared";

const makeCategory = (over: Record<string, unknown> = {}) => ({
  id: "cat-1",
  storeId: "store-1",
  name: "Chicken",
  tamilName: "சிக்கன்",
  description: null,
  displayOrder: 0,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

// Typed prisma mock so TypeScript is happy.
function buildPrisma() {
  return {
    category: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    product: {
      count: jest.fn(),
    },
  } as unknown as PrismaService;
}

describe("CategoriesService", () => {
  const storeId = "store-1";
  let svc: CategoriesService;
  let prisma: ReturnType<typeof buildPrisma>;

  beforeEach(async () => {
    prisma = buildPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    svc = module.get(CategoriesService);
  });

  it("lists active categories for a store", async () => {
    (prisma.category.findMany as jest.Mock).mockResolvedValue([makeCategory()]);
    const result = await svc.list(storeId);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Chicken");
  });

  it("creates a category", async () => {
    const cat = makeCategory({ name: "Drinks" });
    (prisma.category.create as jest.Mock).mockResolvedValue(cat);
    const result = await svc.create(storeId, {
      name: "Drinks",
      tamilName: "பானங்கள்",
      displayOrder: 1,
      isActive: true,
    });
    expect(result.name).toBe("Drinks");
    expect(prisma.category.create).toHaveBeenCalled();
  });

  it("throws NOT_FOUND when updating a non-existent category", async () => {
    (prisma.category.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(
      svc.update(storeId, "nonexistent", { name: "X" }),
    ).rejects.toMatchObject({ code: API_ERROR_CODES.NOT_FOUND });
  });

  it("throws NOT_FOUND when removing a non-existent category", async () => {
    (prisma.category.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(svc.remove(storeId, "nonexistent")).rejects.toMatchObject({
      code: API_ERROR_CODES.NOT_FOUND,
    });
  });

  it("throws CATEGORY_HAS_PRODUCTS when removing a category with products", async () => {
    (prisma.category.findFirst as jest.Mock).mockResolvedValue(makeCategory());
    (prisma.product.count as jest.Mock).mockResolvedValue(3);
    await expect(svc.remove(storeId, "cat-1")).rejects.toBeInstanceOf(ApiException);
  });

  it("hard-deletes a category when it has no products", async () => {
    (prisma.category.findFirst as jest.Mock).mockResolvedValue(makeCategory());
    (prisma.product.count as jest.Mock).mockResolvedValue(0);
    (prisma.category.delete as jest.Mock).mockResolvedValue(makeCategory());
    const result = await svc.remove(storeId, "cat-1");
    expect(result).toMatchObject({ success: true });
    expect(prisma.category.delete).toHaveBeenCalled();
  });
});
