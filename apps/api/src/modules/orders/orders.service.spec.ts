import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { PaymentsService } from "../payments/payments.service";
import { OrderNumberService } from "./order-number.service";
import { OrdersService } from "./orders.service";
import { ApiException } from "../../common/errors/api.exception";
import { API_ERROR_CODES } from "@cartsas/shared";
import { toPrismaDecimal } from "../../common/mappers/decimal";

/**
 * Focused unit tests for `OrdersService.createFromPublic` — validates every
 * refusal path (store closed, wrong tenant product, unavailable, empty cart)
 * and the happy path with server-side total recomputation.
 *
 * PrismaService is mocked so we can assert transaction boundaries and
 * verify the service is authoritative on price / totals / order-number.
 */
describe("OrdersService.createFromPublic", () => {
  const storeId = "store-1";

  const buildProduct = (over: Partial<any> = {}) => ({
    id: "p1",
    storeId,
    categoryId: "c1",
    name: "Chicken Kothu Parotta",
    tamilName: "சிக்கன் கொத்து பரோட்டா",
    price: toPrismaDecimal(120),
    unit: "plate",
    imageUrl: null,
    isAvailable: true,
    stockQuantity: null,
    lowStockThreshold: null,
    displayOrder: 0,
    description: null,
    tamilDescription: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  });

  function buildTx(products: any[], store: any = { id: storeId, status: "OPEN", settings: { acceptOrders: true, minimumOrderValue: toPrismaDecimal(0), estimatedPreparationMinutes: 15 } }) {
    return {
      store: {
        findUnique: jest.fn().mockResolvedValue(store),
      },
      product: {
        findMany: jest.fn().mockResolvedValue(products),
        update: jest.fn().mockResolvedValue(undefined),
      },
      customer: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "cust-1" }),
        update: jest.fn().mockResolvedValue({ id: "cust-1" }),
      },
      orderSequence: {
        upsert: jest.fn().mockResolvedValue({ storeId, nextValue: 2 }),
      },
      order: {
        create: jest.fn().mockImplementation(({ data }) => ({
          id: "order-1",
          storeId,
          customerId: data.customerId ?? null,
          orderNumber: data.orderNumber,
          status: data.status,
          paymentStatus: data.paymentStatus,
          paymentMethod: data.paymentMethod,
          subtotal: data.subtotal,
          discountAmount: data.discountAmount,
          taxAmount: data.taxAmount,
          totalAmount: data.totalAmount,
          notes: data.notes,
          createdAt: new Date(),
          updatedAt: new Date(),
          completedAt: null,
          cancelledAt: null,
          items: data.items.create.map((i: any, idx: number) => ({
            id: `item-${idx}`,
            orderId: "order-1",
            createdAt: new Date(),
            ...i,
          })),
          customer: data.customerId ? { id: data.customerId, storeId, name: null, phone: null, createdAt: new Date(), updatedAt: new Date() } : null,
        })),
        update: jest.fn().mockImplementation(({ data }) => ({
          id: "order-1",
          storeId,
          customerId: "cust-1",
          orderNumber: "FC-1001",
          status: "NEW",
          paymentStatus: data.paymentStatus,
          paymentMethod: data.paymentMethod,
          subtotal: toPrismaDecimal(280),
          discountAmount: toPrismaDecimal(0),
          taxAmount: toPrismaDecimal(0),
          totalAmount: toPrismaDecimal(280),
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          completedAt: null,
          cancelledAt: null,
          items: [],
          customer: null,
        })),
      },
      orderStatusHistory: {
        create: jest.fn().mockResolvedValue(undefined),
      },
      payment: {
        create: jest.fn().mockImplementation(({ data }) => ({
          id: "pay-1",
          orderId: data.orderId,
          provider: data.provider,
          providerPaymentId: data.providerPaymentId,
          method: data.method,
          status: data.status,
          amount: data.amount,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      },
    };
  }

  async function build(products: any[], store?: any) {
    const tx = buildTx(products, store);
    const prisma = {
      $transaction: jest.fn().mockImplementation((cb: any) => cb(tx)),
    } as unknown as PrismaService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: PaymentsService,
          useValue: {
            chargeAndRecord: jest.fn().mockResolvedValue({
              result: { status: "PAID", method: "SIMULATED", provider: "SIMULATED", providerPaymentId: "sim_1" },
              payment: {},
            }),
          },
        },
        OrderNumberService,
      ],
    }).compile();

    return { svc: module.get(OrdersService), tx };
  }

  it("creates an order with backend-computed totals", async () => {
    const products = [buildProduct(), buildProduct({ id: "p2", name: "Lemon Soda", price: toPrismaDecimal(40), unit: "glass" })];
    const { svc, tx } = await build(products);

    const result = await svc.createFromPublic(storeId, {
      customer: { name: "Karthik", phone: "999" },
      items: [
        { productId: "p1", quantity: 2 },
        { productId: "p2", quantity: 1 },
      ],
    } as any);

    expect(result.orderNumber).toBe("FC-1001");
    expect(result.paymentStatus).toBe("PAID");
    // 120*2 + 40*1 = 280 — recomputed by backend.
    expect(tx.order.create).toHaveBeenCalled();
    const call = (tx.order.create as jest.Mock).mock.calls[0][0].data;
    expect(Number(call.subtotal.toString())).toBe(280);
    expect(Number(call.totalAmount.toString())).toBe(280);
  });

  it("rejects an empty cart", async () => {
    const { svc } = await build([]);
    await expect(
      svc.createFromPublic(storeId, { items: [], customer: {} } as any),
    ).rejects.toMatchObject({ code: API_ERROR_CODES.EMPTY_CART });
  });

  it("rejects when the store is closed", async () => {
    const products = [buildProduct()];
    const { svc } = await build(products, {
      id: storeId,
      status: "CLOSED",
      settings: { acceptOrders: true, minimumOrderValue: toPrismaDecimal(0), estimatedPreparationMinutes: 15 },
    });
    await expect(
      svc.createFromPublic(storeId, {
        items: [{ productId: "p1", quantity: 1 }],
        customer: {},
      } as any),
    ).rejects.toBeInstanceOf(ApiException);
  });

  it("rejects a cross-store product", async () => {
    const products = [buildProduct({ storeId: "other-store" })];
    const { svc } = await build(products);
    await expect(
      svc.createFromPublic(storeId, {
        items: [{ productId: "p1", quantity: 1 }],
        customer: {},
      } as any),
    ).rejects.toMatchObject({ code: API_ERROR_CODES.CROSS_STORE_PRODUCT });
  });

  it("rejects an unavailable product", async () => {
    const products = [buildProduct({ isAvailable: false })];
    const { svc } = await build(products);
    await expect(
      svc.createFromPublic(storeId, {
        items: [{ productId: "p1", quantity: 1 }],
        customer: {},
      } as any),
    ).rejects.toMatchObject({ code: API_ERROR_CODES.PRODUCT_UNAVAILABLE });
  });

  it("rejects when insufficient stock", async () => {
    const products = [buildProduct({ stockQuantity: toPrismaDecimal(1) })];
    const { svc } = await build(products);
    await expect(
      svc.createFromPublic(storeId, {
        items: [{ productId: "p1", quantity: 5 }],
        customer: {},
      } as any),
    ).rejects.toMatchObject({ code: API_ERROR_CODES.PRODUCT_OUT_OF_STOCK });
  });

  it("rejects below-minimum totals", async () => {
    const products = [buildProduct({ price: toPrismaDecimal(10) })];
    const { svc } = await build(products, {
      id: storeId,
      status: "OPEN",
      settings: { acceptOrders: true, minimumOrderValue: toPrismaDecimal(100), estimatedPreparationMinutes: 15 },
    });
    await expect(
      svc.createFromPublic(storeId, {
        items: [{ productId: "p1", quantity: 1 }],
        customer: {},
      } as any),
    ).rejects.toMatchObject({ code: API_ERROR_CODES.BELOW_MIN_ORDER });
  });
});
