import type { Role } from '../generated/prisma/enums.js';

/**
 * Seed data mirror for Phase 1. Copy of the frontend fixtures
 * (`src/data/menu.ts`, `src/data/tables.ts`, `src/config.ts`) — the server
 * never imports frontend files. Phase 2 will pick a single source of truth.
 */

export interface SeedRestaurant {
  slug: string;
  name: string;
  address: string;
  phone: string;
  taxRateBps: number;
  currency: string;
  timezone: string;
}

export interface SeedCategory {
  name: string;
  sortOrder: number;
}

export interface SeedMenuItem {
  legacyId: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageKey: string;
  popular: boolean;
  sortOrder: number;
}

export interface SeedTable {
  legacyId: string;
  name: string;
  seats: number;
  sortOrder: number;
}

export interface SeedUser {
  email: string;
  name: string;
  password: string;
  pin: string;
  role: Role;
}

export const SEED_RESTAURANT: SeedRestaurant = {
  slug: 'restodash',
  name: 'RestoDash',
  address: '123 Đường Trung Tâm, Quận 1, TP.HCM',
  phone: '0901 234 567',
  taxRateBps: 800,
  currency: 'VND',
  timezone: 'Asia/Ho_Chi_Minh',
};

export const SEED_CATEGORIES: SeedCategory[] = [
  { name: 'all', sortOrder: 0 },
  { name: 'popular', sortOrder: 1 },
  { name: 'drinks', sortOrder: 2 },
  { name: 'starters', sortOrder: 3 },
  { name: 'mains', sortOrder: 4 },
  { name: 'desserts', sortOrder: 5 },
];

export const SEED_MENU_ITEMS: SeedMenuItem[] = [
  {
    legacyId: 'ga-nuong',
    name: 'Gà nướng',
    description: 'Gà nướng than hoa, sốt tiêu chanh',
    price: 109000,
    category: 'mains',
    imageKey: 'grilled-chicken.webp',
    popular: true,
    sortOrder: 0,
  },
  {
    legacyId: 'burger-bo',
    name: 'Burger bò',
    description: 'Bò Úc, phô mai cheddar, khoai tây chiên',
    price: 89000,
    category: 'mains',
    imageKey: 'beef-burger.webp',
    popular: true,
    sortOrder: 1,
  },
  {
    legacyId: 'pizza-margherita',
    name: 'Pizza Margherita',
    description: 'Đế mỏng, sốt cà chua, phô mai mozzarella',
    price: 129000,
    category: 'mains',
    imageKey: 'margherita-pizza.webp',
    popular: true,
    sortOrder: 2,
  },
  {
    legacyId: 'salad-caesar',
    name: 'Salad Caesar',
    description: 'Rau romaine, parmesan, sốt Caesar',
    price: 69000,
    category: 'starters',
    imageKey: 'caesar-salad.webp',
    popular: false,
    sortOrder: 3,
  },
  {
    legacyId: 'khoai-tay-chien',
    name: 'Khoai tây chiên',
    description: 'Giòn ngoài, mềm trong, muối biển',
    price: 39000,
    category: 'starters',
    imageKey: 'french-fries.webp',
    popular: true,
    sortOrder: 4,
  },
  {
    legacyId: 'mi-y-ga',
    name: 'Mì Ý gà',
    description: 'Sốt kem cà chua, gà áp chảo',
    price: 85000,
    category: 'mains',
    imageKey: 'chicken-pasta.webp',
    popular: false,
    sortOrder: 5,
  },
  {
    legacyId: 'banh-chocolate',
    name: 'Bánh chocolate',
    description: 'Chocolate 70%, kem tươi',
    price: 45000,
    category: 'desserts',
    imageKey: 'chocolate-cake.webp',
    popular: false,
    sortOrder: 6,
  },
  {
    legacyId: 'nuoc-chanh',
    name: 'Nước chanh',
    description: 'Chanh tươi, đường mía, đá',
    price: 29000,
    category: 'drinks',
    imageKey: 'lemonade.webp',
    popular: false,
    sortOrder: 7,
  },
  {
    legacyId: 'ca-phe-nong',
    name: 'Cà phê nóng',
    description: 'Robusta pha phin, sữa đặc',
    price: 25000,
    category: 'drinks',
    imageKey: 'hot-coffee.webp',
    popular: true,
    sortOrder: 8,
  },
  {
    legacyId: 'banh-mi-rau',
    name: 'Bánh mì rau',
    description: 'Bánh mì giòn, rau củ nướng',
    price: 49000,
    category: 'starters',
    imageKey: 'veg-sandwich.webp',
    popular: false,
    sortOrder: 9,
  },
  {
    legacyId: 'banh-mi-bo-toi',
    name: 'Bánh mì bơ tỏi',
    description: 'Bơ tỏi, rau thơm, phô mai',
    price: 35000,
    category: 'starters',
    imageKey: 'garlic-bread.webp',
    popular: false,
    sortOrder: 10,
  },
  {
    legacyId: 'kem',
    name: 'Kem',
    description: 'Kem vani, sốt caramel',
    price: 39000,
    category: 'desserts',
    imageKey: 'ice-cream.webp',
    popular: false,
    sortOrder: 11,
  },
  {
    legacyId: 'tra-dao',
    name: 'Trà đào',
    description: 'Trà đen, đào ngâm, đá',
    price: 35000,
    category: 'drinks',
    imageKey: 'peach-tea.webp',
    popular: true,
    sortOrder: 12,
  },
  {
    legacyId: 'sinh-to-xoai',
    name: 'Sinh tố xoài',
    description: 'Xoài chín, sữa chua',
    price: 45000,
    category: 'drinks',
    imageKey: 'mango-smoothie.webp',
    popular: false,
    sortOrder: 13,
  },
  {
    legacyId: 'goi-cuon',
    name: 'Gỏi cuốn',
    description: 'Tôm, thịt, bún, rau sống',
    price: 55000,
    category: 'starters',
    imageKey: 'spring-rolls.webp',
    popular: false,
    sortOrder: 14,
  },
  {
    legacyId: 'che',
    name: 'Chè',
    description: 'Chè ba màu, nước cốt dừa',
    price: 30000,
    category: 'desserts',
    imageKey: 'che.webp',
    popular: false,
    sortOrder: 15,
  },
];

function seatCountForIndex(index: number): number {
  if (index < 4) return 2;
  if (index < 8) return 4;
  return 6;
}

export const SEED_TABLES: SeedTable[] = Array.from(
  { length: 12 },
  (_, index) => ({
    legacyId: `ban-${index + 1}`,
    name: `Bàn ${String(index + 1).padStart(2, '0')}`,
    seats: seatCountForIndex(index),
    sortOrder: index,
  }),
);

/**
 * Local-only sample accounts. Re-running the seed resets these passwords
 * and PINs; never use them outside local development.
 */
export const SEED_USERS: SeedUser[] = [
  {
    email: 'owner@restodash.local',
    name: 'Chủ quán',
    password: 'Owner@12345',
    pin: '1234',
    role: 'OWNER',
  },
  {
    email: 'manager@restodash.local',
    name: 'Quản lý',
    password: 'Manager@12345',
    pin: '2345',
    role: 'MANAGER',
  },
  {
    email: 'cashier@restodash.local',
    name: 'Thu ngân',
    password: 'Cashier@12345',
    pin: '3456',
    role: 'CASHIER',
  },
];
