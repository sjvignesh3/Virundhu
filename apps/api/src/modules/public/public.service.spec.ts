import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { PublicService } from "./public.service";
import { API_ERROR_CODES } from "@virundhu/shared";
import { toPrismaDecimal } from "../../common/mappers/decimal";

const makeSettings = (over: Record<string, unknown> = {}) => ({
  id: "set-1",
  storeId: "store-1",
  defaultLanguage: "en",
  showTamilNames: true,
  showUnavailable: false,
  acceptOrders: true,
  minimumOrderValue: toPrismaDecimal(0),
  estimatedPreparationMinutes: 15,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

const makeStore = (over: Record<string, unknown> = {}) => ({
  id: "store-1",
  slug: "anna-street-food",
  name: "Anna Street Food",
  tamilName: "அண்ணா தெரு உணவு",
  description: "Authentic Tamil street food",
  phone: "+91 90000 00000",
  address: "T. Nagar, Chennai",
  logoUrl: null,
  imageUrl: null,
  status: "OPEN",
  createdAt: new Date(),
  updatedAt: new Date(),
  settings: makeSettings(),
  ...over,
});

const makeProduct = (over: Record<string, unknown> = {}) => ({
  id: "p1",
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

function buildPrisma() {
  return {
    store: { findUnique: jest.fn() },
    storeSettings: { create: jest.fn() },
    category: { findMany: jest.fn() },
    product: { findMany: jest.fn() },
    order: { findUnique: jest.fn() },
  } as unknown as PrismaService;
}

describe("PublicService", () => {
  let svc: PublicService;
  let prisma: ReturnType<typeof buildPrisma>;

  beforeEach(async () => {
    prisma = buildPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    svc = module.get(PublicService);
  });

  describe("getStoreBySlug", () => {
    it("returns public store DTO with settings", async () => {
      (prisma.store.findUnique as jest.Mock).mockResolvedValue(makeStore());
      const { store } = await svc.getStoreBySlug("anna-street-food");
      expect(store.slug).toBe("anna-street-food");
      expect(store.settings.showTamilNames).toBe(true);
      // Must not expose internal/private fields.
      const storeAsAny = store as unknown as Record<string, unknown>;
      expect(storeAsAny.users).toBeUndefined();
      expect(storeAsAny.passwordHash).toBeUndefined();
    });

    it("throws NOT_FOUND for unknown slug", async () => {
      (prisma.store.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(svc.getStoreBySlug("not-a-store")).rejects.toMatchObject({
        code: API_ERROR_CODES.NOT_FOUND,
      });
    });
  });

  describe("listPublicProducts", () => {
    it("returns available products by default", async () => {
      (prisma.store.findUnique as jest.Mock).mockResolvedValue(makeStore());
      (prisma.product.findMany as jest.Mock).mockResolvedValue([makeProduct()]);
      const result = await svc.listPublicProducts("anna-street-food");
      expect(result).toHaveLength(1);
      // Price is marshalled to number.
      expect(typeof result[0].price).toBe("number");
    });

    it("returns all products when includeUnavailable=true", async () => {
      (prisma.store.findUnique as jest.Mock).mockResolvedValue(makeStore());
      (prisma.product.findMany as jest.Mock).mockResolvedValue([
        makeProduct(),
        makeProduct({ id: "p2", isAvailable: false }),
      ]);
      const result = await svc.listPublicProducts("anna-street-food", {
        includeUnavailable: true,
      });
      expect(result).toHaveLength(2);
    });
  });

  describe("listPublicCategories", () => {
    it("returns active categories for the store", async () => {
      (prisma.store.findUnique as jest.Mock).mockResolvedValue(makeStore());
      (prisma.category.findMany as jest.Mock).mockResolvedValue([
        {
          id: "cat-1",
          storeId: "store-1",
          name: "Chicken",
          tamilName: "சிக்கன்",
          description: null,
          displayOrder: 0,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      const result = await svc.listPublicCategories("anna-street-food");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Chicken");
    });
  });
});
