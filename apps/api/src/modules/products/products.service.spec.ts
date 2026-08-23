import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { ProductsService } from "./products.service";
import { API_ERROR_CODES } from "@cartsas/shared";
import { toPrismaDecimal } from "../../common/mappers/decimal";

const makeProduct = (over: Record<string, unknown> = {}) => ({
  id: "prod-1",
  storeId: "store-1",
  categoryId: "cat-1",
  name: "Chicken Kothu Parotta",
  tamilName: "சிக்கன் கொத்து பரோட்டா",
  description: null,
  tamilDescription: null,
  price: toPrismaDecimal(120),
  unit: "plate",
  imageUrl: null,
  isAvailable: true,
  stockQuantity: null,
  lowStockThreshold: null,
  displayOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

const makeCategory = (over: Record<string, unknown> = {}) => ({
  id: "cat-1",
  storeId: "store-1",
  name: "Chicken",
  tamilName: null,
  description: null,
  displayOrder: 0,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

// Build a typed mock prisma object.
function buildPrisma() {
  return {
    product: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    category: {
      findFirst: jest.fn(),
    },
    orderItem: {
      count: jest.fn(),
    },
  } as unknown as PrismaService;
}

describe("ProductsService", () => {
  const storeId = "store-1";
  let svc: ProductsService;
  let prisma: ReturnType<typeof buildPrisma>;

  beforeEach(async () => {
    prisma = buildPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    svc = module.get(ProductsService);
  });

  it("lists products for a store", async () => {
    (prisma.product.findMany as jest.Mock).mockResolvedValue([makeProduct()]);
    const result = await svc.list(storeId);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Chicken Kothu Parotta");
    expect(result[0].price).toBe(120);
  });

  it("creates a product with tenant-safe category", async () => {
    (prisma.category.findFirst as jest.Mock).mockResolvedValue(makeCategory());
    (prisma.product.create as jest.Mock).mockResolvedValue(makeProduct({ name: "Tea" }));
    const result = await svc.create(storeId, {
      categoryId: "cat-1",
      name: "Tea",
      price: 15,
      unit: "cup" as const,
      isAvailable: true,
      displayOrder: 0,
    });
    expect(result.name).toBe("Tea");
    expect(prisma.product.create).toHaveBeenCalled();
  });

  it("rejects creation with a category from a different store", async () => {
    (prisma.category.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(
      svc.create("store-1", {
        categoryId: "cat-from-other-store",
        name: "Product X",
        price: 50,
        unit: "plate" as const,
        isAvailable: true,
        displayOrder: 0,
      }),
    ).rejects.toMatchObject({ code: API_ERROR_CODES.CROSS_STORE_PRODUCT });
  });

  it("returns 404 for unknown product", async () => {
    (prisma.product.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(svc.get(storeId, "nonexistent")).rejects.toMatchObject({
      code: API_ERROR_CODES.NOT_FOUND,
    });
  });

  it("soft-deletes a product that has order history", async () => {
    (prisma.product.findFirst as jest.Mock).mockResolvedValue(makeProduct());
    (prisma.orderItem.count as jest.Mock).mockResolvedValue(5);
    (prisma.product.update as jest.Mock).mockResolvedValue(makeProduct({ isAvailable: false }));
    const result = await svc.remove(storeId, "prod-1");
    expect(result).toMatchObject({ success: true, softDeleted: true });
    expect(prisma.product.update).toHaveBeenCalled();
    expect(prisma.product.delete).not.toHaveBeenCalled();
  });

  it("hard-deletes a product that has no order history", async () => {
    (prisma.product.findFirst as jest.Mock).mockResolvedValue(makeProduct());
    (prisma.orderItem.count as jest.Mock).mockResolvedValue(0);
    (prisma.product.delete as jest.Mock).mockResolvedValue(makeProduct());
    const result = await svc.remove(storeId, "prod-1");
    expect(result).toMatchObject({ success: true, softDeleted: false });
    expect(prisma.product.delete).toHaveBeenCalled();
  });

  it("sets product availability", async () => {
    (prisma.product.findFirst as jest.Mock).mockResolvedValue(makeProduct());
    (prisma.product.update as jest.Mock).mockResolvedValue(makeProduct({ isAvailable: false }));
    const result = await svc.setAvailability(storeId, "prod-1", false);
    expect(result.isAvailable).toBe(false);
  });

  it("maps Decimal price to number on the DTO boundary", async () => {
    (prisma.product.findMany as jest.Mock).mockResolvedValue([
      makeProduct({ price: toPrismaDecimal(199.99) }),
    ]);
    const [p] = await svc.list(storeId);
    expect(typeof p.price).toBe("number");
    expect(p.price).toBeCloseTo(199.99);
  });
});
