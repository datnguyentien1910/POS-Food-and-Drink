import type { PrismaClient } from '../generated/prisma/client.js';
import { hashSecret } from '../common/security/hash.js';
import {
  SEED_CATEGORIES,
  SEED_MENU_ITEMS,
  SEED_RESTAURANT,
  SEED_TABLES,
  SEED_USERS,
} from './seed-data.js';

export interface SeedOptions {
  pinPepper: string;
}

/**
 * Idempotent seed. Running it repeatedly must not duplicate rows, but it does
 * reset the sample account passwords and PINs (see `SEED_USERS`).
 */
export async function seed(
  prisma: PrismaClient,
  options: SeedOptions,
): Promise<void> {
  const restaurant = await prisma.restaurant.upsert({
    where: { slug: SEED_RESTAURANT.slug },
    create: {
      slug: SEED_RESTAURANT.slug,
      name: SEED_RESTAURANT.name,
      address: SEED_RESTAURANT.address,
      phone: SEED_RESTAURANT.phone,
      taxRateBps: SEED_RESTAURANT.taxRateBps,
      currency: SEED_RESTAURANT.currency,
      timezone: SEED_RESTAURANT.timezone,
    },
    update: {
      name: SEED_RESTAURANT.name,
      address: SEED_RESTAURANT.address,
      phone: SEED_RESTAURANT.phone,
      taxRateBps: SEED_RESTAURANT.taxRateBps,
      currency: SEED_RESTAURANT.currency,
      timezone: SEED_RESTAURANT.timezone,
    },
  });

  for (const category of SEED_CATEGORIES) {
    await prisma.category.upsert({
      where: {
        restaurantId_name: {
          restaurantId: restaurant.id,
          name: category.name,
        },
      },
      create: {
        restaurantId: restaurant.id,
        name: category.name,
        sortOrder: category.sortOrder,
      },
      update: {
        sortOrder: category.sortOrder,
      },
    });
  }

  const categories = await prisma.category.findMany({
    where: { restaurantId: restaurant.id },
  });
  const categoryIdByName = new Map(
    categories.map((category) => [category.name, category.id]),
  );

  for (const user of SEED_USERS) {
    const passwordHash = await hashSecret(user.password);
    const pinHash = await hashSecret(user.pin, options.pinPepper);

    const account = await prisma.user.upsert({
      where: { email: user.email },
      create: {
        email: user.email,
        name: user.name,
        passwordHash,
        pinHash,
        active: true,
      },
      update: {
        name: user.name,
        passwordHash,
        pinHash,
        active: true,
      },
    });

    await prisma.membership.upsert({
      where: {
        restaurantId_userId: {
          restaurantId: restaurant.id,
          userId: account.id,
        },
      },
      create: {
        restaurantId: restaurant.id,
        userId: account.id,
        role: user.role,
      },
      update: {
        role: user.role,
      },
    });
  }

  for (const item of SEED_MENU_ITEMS) {
    const categoryId = categoryIdByName.get(item.category);
    if (!categoryId) {
      throw new Error(`Seed menu item ${item.legacyId} has no category`);
    }

    await prisma.menuItem.upsert({
      where: {
        restaurantId_legacyId: {
          restaurantId: restaurant.id,
          legacyId: item.legacyId,
        },
      },
      create: {
        restaurantId: restaurant.id,
        categoryId,
        legacyId: item.legacyId,
        name: item.name,
        description: item.description,
        price: item.price,
        imageKey: item.imageKey,
        available: true,
        popular: item.popular,
        sortOrder: item.sortOrder,
      },
      update: {
        categoryId,
        name: item.name,
        description: item.description,
        price: item.price,
        imageKey: item.imageKey,
        available: true,
        popular: item.popular,
        sortOrder: item.sortOrder,
      },
    });
  }

  for (const table of SEED_TABLES) {
    await prisma.table.upsert({
      where: {
        restaurantId_legacyId: {
          restaurantId: restaurant.id,
          legacyId: table.legacyId,
        },
      },
      create: {
        restaurantId: restaurant.id,
        legacyId: table.legacyId,
        name: table.name,
        seats: table.seats,
        sortOrder: table.sortOrder,
      },
      update: {
        name: table.name,
        seats: table.seats,
        sortOrder: table.sortOrder,
      },
    });
  }
}
