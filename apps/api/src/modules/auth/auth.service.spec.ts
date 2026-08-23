import { Test, TestingModule } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { AuthService } from "./auth.service";
import { PrismaService } from "../../prisma/prisma.service";
import { API_ERROR_CODES } from "@cartsas/shared";

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
    user: { findUnique: jest.fn() },
  } as unknown as PrismaService;
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
});
