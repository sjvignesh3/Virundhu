/**
 * Idempotent seed for the demo store "Anna Street Food".
 *
 * Runs exactly once per browser (guarded by `cartsas:v1:seeded`). Anyone can
 * wipe localStorage via DevTools to reseed. Uses fixed ids so re-running the
 * seed on a partially-populated store is deterministic — but we don't rely on
 * that in production; the flag is the source of truth.
 */

import { newId, now } from "@/lib/domain/ids";
import type { Category, Product, Store } from "@/lib/domain/types";
import { STORAGE_KEYS } from "@/lib/storage/keys";
import { readJSON, writeCollection, writeJSON } from "@/lib/storage/local-storage";
import { emit } from "@/lib/storage/event-bus";

export const DEMO_STORE_SLUG = "anna-street-food";

interface SeedProductSpec {
  name: string;
  tamilName: string;
  price: number;
  unit: Product["unit"];
  categoryName: string;
}

const CATEGORY_NAMES: Array<{ name: string; tamilName: string }> = [
  { name: "Chicken", tamilName: "சிக்கன்" },
  { name: "Snacks", tamilName: "தின்பண்டங்கள்" },
  { name: "Rice & Meals", tamilName: "சாதம் & உணவு" },
  { name: "Drinks", tamilName: "பானங்கள்" },
  { name: "Egg", tamilName: "முட்டை" },
];

const PRODUCTS: SeedProductSpec[] = [
  { name: "Chicken Kothu Parotta", tamilName: "சிக்கன் கொத்து பரோட்டா", price: 120, unit: "plate", categoryName: "Chicken" },
  { name: "Egg Kothu Parotta", tamilName: "முட்டை கொத்து பரோட்டா", price: 90, unit: "plate", categoryName: "Egg" },
  { name: "Chicken 65", tamilName: "சிக்கன் 65", price: 140, unit: "plate", categoryName: "Chicken" },
  { name: "Chicken Rice", tamilName: "சிக்கன் சாதம்", price: 110, unit: "plate", categoryName: "Rice & Meals" },
  { name: "Egg Rice", tamilName: "முட்டை சாதம்", price: 80, unit: "plate", categoryName: "Rice & Meals" },
  { name: "Parotta", tamilName: "பரோட்டா", price: 20, unit: "piece", categoryName: "Snacks" },
  { name: "Omelette", tamilName: "ஆம்லெட்", price: 40, unit: "plate", categoryName: "Egg" },
  { name: "Lemon Soda", tamilName: "லெமன் சோடா", price: 40, unit: "glass", categoryName: "Drinks" },
  { name: "Fresh Lime", tamilName: "எலுமிச்சை ஜூஸ்", price: 30, unit: "glass", categoryName: "Drinks" },
  { name: "Tea", tamilName: "டீ", price: 15, unit: "cup", categoryName: "Drinks" },
];

export function isSeeded(): boolean {
  return readJSON<boolean>(STORAGE_KEYS.seeded, false) === true;
}

/**
 * Seeds the demo store. No-op if `seeded` flag is set.
 * Safe to call on every mount.
 */
export function seedIfNeeded(): void {
  if (isSeeded()) return;

  const ts = now();

  const store: Store = {
    id: newId(),
    slug: DEMO_STORE_SLUG,
    name: "Anna Street Food",
    tamilName: "அண்ணா தெரு உணவு",
    description: "Authentic Tamil street food — kothu parotta, chicken 65, and more.",
    phone: "+91 90000 00000",
    address: "12 Ranganathan St, T. Nagar, Chennai",
    status: "OPEN",
    minOrderValue: 0,
    prepTimeMinutes: 15,
    language: "en",
    showTamilNames: true,
    showUnavailable: false,
    accent: "#f97316",
    createdAt: ts,
    updatedAt: ts,
  };

  const categories: Category[] = CATEGORY_NAMES.map((c, i) => ({
    id: newId(),
    storeId: store.id,
    name: c.name,
    tamilName: c.tamilName,
    sortOrder: i,
    createdAt: ts,
    updatedAt: ts,
  }));

  const catByName = new Map(categories.map((c) => [c.name, c]));

  const products: Product[] = PRODUCTS.map((p) => {
    const cat = catByName.get(p.categoryName);
    if (!cat) throw new Error(`Seed: unknown category "${p.categoryName}"`);
    return {
      id: newId(),
      storeId: store.id,
      categoryId: cat.id,
      name: p.name,
      tamilName: p.tamilName,
      price: p.price,
      unit: p.unit,
      available: true,
      createdAt: ts,
      updatedAt: ts,
    };
  });

  writeCollection(STORAGE_KEYS.stores, [store]);
  writeCollection(STORAGE_KEYS.categories, categories);
  writeCollection(STORAGE_KEYS.products, products);
  writeJSON(STORAGE_KEYS.seeded, true);

  emit("stores");
  emit("categories");
  emit("products");
}
