import { Test, TestingModule } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { AuthService } from "./auth.service";
import { PrismaService } from "../../prisma/prisma.service";
import { API_ERROR_CODES } from "@virundhu/shared";

const HASHED_PASSWORD = bcrypt.hashSync("owner123", 10);

const makeUser = (over: Record<string, unknown> = {}) => ({
  id: "user-1",
  name: "Anna Owner",
  email: "owner@anna.test",
  phone: null,
  passwordHash: HASHED_PASSWORD,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  memberships: [
    {
      id: "mem-1",
      storeId: "store-1",
      userId: "user-1",
      role: "OWNER",
      createdAt: new Date(),
      store: {
        id: "store-1",
        slug: "anna-street-food",
        name: "Anna Street Food",
        tamilName: null,
        description: null,
        phone: null,
        address: null,
        logoUrl: null,
        imageUrl: null,
        status: "OPEN",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
  ],
  ...over,
});

function buildPrisma() {
  return {
    user: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn() },
    store: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  } as unknown as PrismaService & Record<string, unknown>;
}

describe("AuthService", () => {
  let svc: AuthService;
  let prisma: ReturnType<typeof buildPrisma>;
  let jwt: { signAsync: jest.Mock };

  beforeEach(async () => {
    prisma = buildPrisma();
    jwt = { signAsync: jest.fn().mockResolvedValue("tok.en.here") };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();

    svc = module.get(AuthService);
  });

  it("returns an access token and memberships on valid credentials", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(makeUser());
    const result = await svc.login({ email: "owner@anna.test", password: "owner123" });
    expect(result.accessToken).toBe("tok.en.here");
    expect(result.user.email).toBe("owner@anna.test");
    expect(result.memberships).toHaveLength(1);
    expect(result.memberships[0].role).toBe("OWNER");
  });

  it("throws INVALID_CREDENTIALS for wrong password", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(makeUser());
    await expect(
      svc.login({ email: "owner@anna.test", password: "wrongpassword" }),
    ).rejects.toMatchObject({ code: API_ERROR_CODES.INVALID_CREDENTIALS });
  });

  it("throws INVALID_CREDENTIALS for non-existent user", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(
      svc.login({ email: "nobody@example.com", password: "any" }),
    ).rejects.toMatchObject({ code: API_ERROR_CODES.INVALID_CREDENTIALS });
  });

  it("throws INVALID_CREDENTIALS for inactive user", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(makeUser({ isActive: false }));
    await expect(
      svc.login({ email: "owner@anna.test", password: "owner123" }),
    ).rejects.toMatchObject({ code: API_ERROR_CODES.INVALID_CREDENTIALS });
  });

  it("does not expose passwordHash in the response", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(makeUser());
    const result = await svc.login({ email: "owner@anna.test", password: "owner123" });
    // UserDTO interface does not have passwordHash — verify at runtime.
    const userAsAny = result.user as unknown as Record<string, unknown>;
    expect(userAsAny.passwordHash).toBeUndefined();
  });

  describe("signup", () => {
    const validInput = {
      name: "New Owner",
      email: "new@owner.test",
      phone: "+91 90000 11111",
      password: "secret123",
      storeName: "New Cart",
      storeSlug: "new-cart",
      storeTamilName: undefined,
      storeDescription: undefined,
      storePhone: undefined,
      storeAddress: undefined,
    };

    function wireHappyPathTransaction(createdUser: ReturnType<typeof makeUser>) {
      const tx = {
        user: {
          create: jest.fn().mockResolvedValue({ ...createdUser }),
          findUniqueOrThrow: jest.fn().mockResolvedValue(createdUser),
        },
        store: {
          create: jest
            .fn()
            .mockResolvedValue({ id: "store-1", slug: "new-cart", name: "New Cart" }),
        },
        storeUser: { create: jest.fn().mockResolvedValue({}) },
        storeSettings: { create: jest.fn().mockResolvedValue({}) },
        orderSequence: { create: jest.fn().mockResolvedValue({}) },
      };
      (prisma as unknown as { $transaction: jest.Mock }).$transaction.mockImplementation(
        (cb: (t: typeof tx) => Promise<unknown>) => cb(tx),
      );
      return tx;
    }

    it("creates the owner + empty store and returns a JWT session", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.store.findUnique as jest.Mock).mockResolvedValue(null);

      const created = makeUser({
        email: "new@owner.test",
        name: "New Owner",
        memberships: [
          {
            id: "mem-1",
            storeId: "store-1",
            userId: "user-1",
            role: "OWNER",
            createdAt: new Date(),
            store: {
              id: "store-1",
              slug: "new-cart",
              name: "New Cart",
              tamilName: null,
              description: null,
              phone: null,
              address: null,
              logoUrl: null,
              imageUrl: null,
              status: "OPEN",
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
        ],
      });
      const tx = wireHappyPathTransaction(created);

      const result = await svc.signup(validInput);

      expect(result.accessToken).toBe("tok.en.here");
      expect(result.user.email).toBe("new@owner.test");
      expect(result.memberships).toHaveLength(1);
      expect(result.memberships[0].role).toBe("OWNER");
      expect(result.memberships[0].store.slug).toBe("new-cart");

      // Verify no dummy data is created — only the 5 bootstrap rows.
      expect(tx.user.create).toHaveBeenCalledTimes(1);
      expect(tx.store.create).toHaveBeenCalledTimes(1);
      expect(tx.storeUser.create).toHaveBeenCalledWith({
        data: { storeId: "store-1", userId: "user-1", role: "OWNER" },
      });
      expect(tx.storeSettings.create).toHaveBeenCalledTimes(1);
      expect(tx.orderSequence.create).toHaveBeenCalledTimes(1);
    });

    it("hashes the password (never stores plaintext)", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.store.findUnique as jest.Mock).mockResolvedValue(null);
      const created = makeUser({ email: "new@owner.test" });
      const tx = wireHappyPathTransaction(created);

      await svc.signup(validInput);

      const call = tx.user.create.mock.calls[0][0];
      expect(call.data.passwordHash).toBeDefined();
      expect(call.data.passwordHash).not.toBe(validInput.password);
      expect(await bcrypt.compare(validInput.password, call.data.passwordHash)).toBe(true);
    });

    it("rejects duplicate email with CONFLICT", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(makeUser());
      (prisma.store.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(svc.signup(validInput)).rejects.toMatchObject({
        code: API_ERROR_CODES.CONFLICT,
      });
    });

    it("rejects duplicate store slug with CONFLICT", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.store.findUnique as jest.Mock).mockResolvedValue({
        id: "existing",
        slug: "new-cart",
      });

      await expect(svc.signup(validInput)).rejects.toMatchObject({
        code: API_ERROR_CODES.CONFLICT,
      });
    });
  });
});
