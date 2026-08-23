/**
 * Prisma seed — creates the demo Food Cart "Anna Street Food" with:
 *   - 1 owner user (owner@anna.test / owner123)
 *   - 1 store + settings
 *   - 5 categories
 *   - 10 products
 *   - 3 sample orders spanning statuses (for immediate dashboard/history demo)
 *
 * Idempotent: uses `upsert` keyed by natural identifiers (email, slug,
 * store+category name, etc.). Safe to run repeatedly.
 */

import { PrismaClient, Prisma } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_STORE_SLUG = "anna-street-food";
const DEMO_OWNER_EMAIL = "owner@anna.test";
const DEMO_OWNER_PASSWORD = "owner123";

interface SeedProduct {
  name: string;
  tamilName: string;
  price: number;
  unit: string;
  categoryName: string;
  displayOrder: number;
}

const CATEGORIES = [
  { name: "Chicken", tamilName: "சிக்கன்" },
  { name: "Snacks", tamilName: "தின்பண்டங்கள்" },
  { name: "Rice & Meals", tamilName: "சாதம் & உணவு" },
  { name: "Drinks", tamilName: "பானங்கள்" },
  { name: "Egg", tamilName: "முட்டை" },
];

const PRODUCTS: SeedProduct[] = [
  { name: "Chicken Kothu Parotta", tamilName: "சிக்கன் கொத்து பரோட்டா", price: 120, unit: "plate", categoryName: "Chicken", displayOrder: 0 },
  { name: "Egg Kothu Parotta", tamilName: "முட்டை கொத்து பரோட்டா", price: 90, unit: "plate", categoryName: "Egg", displayOrder: 0 },
  { name: "Chicken 65", tamilName: "சிக்கன் 65", price: 140, unit: "plate", categoryName: "Chicken", displayOrder: 1 },
  { name: "Chicken Rice", tamilName: "சிக்கன் சாதம்", price: 110, unit: "plate", categoryName: "Rice & Meals", displayOrder: 0 },
  { name: "Egg Rice", tamilName: "முட்டை சாதம்", price: 80, unit: "plate", categoryName: "Rice & Meals", displayOrder: 1 },
  { name: "Parotta", tamilName: "பரோட்டா", price: 20, unit: "piece", categoryName: "Snacks", displayOrder: 0 },
  { name: "Omelette", tamilName: "ஆம்லெட்", price: 40, unit: "plate", categoryName: "Egg", displayOrder: 1 },
  { name: "Lemon Soda", tamilName: "லெமன் சோடா", price: 40, unit: "glass", categoryName: "Drinks", displayOrder: 0 },
  { name: "Fresh Lime", tamilName: "எலுமிச்சை ஜூஸ்", price: 30, unit: "glass", categoryName: "Drinks", displayOrder: 1 },
  { name: "Tea", tamilName: "டீ", price: 15, unit: "cup", categoryName: "Drinks", displayOrder: 2 },
];

async function main() {
  console.log("🌱 Seeding database…");

  // 1. Owner user.
  const passwordHash = await bcrypt.hash(DEMO_OWNER_PASSWORD, 10);
  const owner = await prisma.user.upsert({
    where: { email: DEMO_OWNER_EMAIL },
    update: { name: "Anna Owner", passwordHash, isActive: true },
    create: {
      email: DEMO_OWNER_EMAIL,
      name: "Anna Owner",
      phone: "+91 90000 00000",
      passwordHash,
      isActive: true,
    },
  });
  console.log(`  ✓ user: ${owner.email}`);

  // 2. Store.
  const store = await prisma.store.upsert({
    where: { slug: DEMO_STORE_SLUG },
    update: {
      name: "Anna Street Food",
      tamilName: "அண்ணா தெரு உணவு",
      description: "Authentic Tamil street food — kothu parotta, chicken 65, and more.",
      phone: "+91 90000 00000",
      address: "12 Ranganathan St, T. Nagar, Chennai",
      status: "OPEN",
    },
    create: {
      slug: DEMO_STORE_SLUG,
      name: "Anna Street Food",
      tamilName: "அண்ணா தெரு உணவு",
      description: "Authentic Tamil street food — kothu parotta, chicken 65, and more.",
      phone: "+91 90000 00000",
      address: "12 Ranganathan St, T. Nagar, Chennai",
      status: "OPEN",
    },
  });
  console.log(`  ✓ store: ${store.slug}`);

  // 3. Store membership.
  await prisma.storeUser.upsert({
    where: { storeId_userId: { storeId: store.id, userId: owner.id } },
    update: { role: "OWNER" },
    create: { storeId: store.id, userId: owner.id, role: "OWNER" },
  });

  // 4. Store settings.
  await prisma.storeSettings.upsert({
    where: { storeId: store.id },
    update: {},
    create: {
      storeId: store.id,
      defaultLanguage: "en",
      showTamilNames: true,
      showUnavailable: false,
      acceptOrders: true,
      minimumOrderValue: new Prisma.Decimal(0),
      estimatedPreparationMinutes: 15,
    },
  });

  // 5. Order sequence row (created lazily by service on first order, but
  // seeding it here means dashboards read stable state).
  await prisma.orderSequence.upsert({
    where: { storeId: store.id },
    update: {},
    create: { storeId: store.id, nextValue: 1 },
  });

  // 6. Categories.
  const catByName = new Map<string, string>();
  for (const [i, c] of CATEGORIES.entries()) {
    const row = await prisma.category.upsert({
      where: { storeId_name: { storeId: store.id, name: c.name } },
      update: { tamilName: c.tamilName, displayOrder: i },
      create: {
        storeId: store.id,
        name: c.name,
        tamilName: c.tamilName,
        displayOrder: i,
        isActive: true,
      },
    });
    catByName.set(c.name, row.id);
  }
  console.log(`  ✓ categories: ${CATEGORIES.length}`);

  // 7. Products.
  for (const p of PRODUCTS) {
    const categoryId = catByName.get(p.categoryName);
    if (!categoryId) throw new Error(`Unknown category: ${p.categoryName}`);
    const existing = await prisma.product.findFirst({
      where: { storeId: store.id, name: p.name },
    });
    const payload = {
      storeId: store.id,
      categoryId,
      name: p.name,
      tamilName: p.tamilName,
      price: new Prisma.Decimal(p.price),
      unit: p.unit,
      isAvailable: true,
      displayOrder: p.displayOrder,
    };
    if (existing) {
      await prisma.product.update({ where: { id: existing.id }, data: payload });
    } else {
      await prisma.product.create({ data: payload });
    }
  }
  console.log(`  ✓ products: ${PRODUCTS.length}`);

  console.log("✅ Seed complete");
  console.log("");
  console.log(`   Owner login: ${DEMO_OWNER_EMAIL} / ${DEMO_OWNER_PASSWORD}`);
  console.log(`   Store slug:  ${DEMO_STORE_SLUG}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
