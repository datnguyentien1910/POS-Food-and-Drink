import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { verifySecret } from '../src/common/security/hash.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { seed } from '../src/prisma/seed.js';
import { createTestApp } from './helpers/create-test-app.js';

interface SeededCounts {
  users: number;
  memberships: number;
  categories: number;
  menuItems: number;
  tables: number;
}

async function countSeededRows(prisma: PrismaService): Promise<SeededCounts> {
  const [users, memberships, categories, menuItems, tables] =
    await Promise.all([
      prisma.user.count(),
      prisma.membership.count(),
      prisma.category.count(),
      prisma.menuItem.count(),
      prisma.table.count(),
    ]);

  return { users, memberships, categories, menuItems, tables };
}

describe('Seed (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const pinPepper = process.env.PIN_PEPPER ?? '';

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('is idempotent when run repeatedly', async () => {
    const before = await countSeededRows(prisma);

    await seed(prisma, { pinPepper });
    await seed(prisma, { pinPepper });

    const after = await countSeededRows(prisma);
    expect(after).toEqual(before);
    expect(after).toEqual({
      users: 3,
      memberships: 3,
      categories: 6,
      menuItems: 16,
      tables: 12,
    });
  });

  it('stores password and PIN hashes that verify for the owner', async () => {
    const owner = await prisma.user.findUniqueOrThrow({
      where: { email: 'owner@restodash.local' },
    });

    await expect(
      verifySecret(owner.passwordHash, 'Owner@12345'),
    ).resolves.toBe(true);
    await expect(
      verifySecret(owner.pinHash ?? '', '1234', pinPepper),
    ).resolves.toBe(true);
  });

  it('attaches every menu item and table to the seeded restaurant', async () => {
    const restaurant = await prisma.restaurant.findUniqueOrThrow({
      where: { slug: 'restodash' },
    });

    const [items, tables] = await Promise.all([
      prisma.menuItem.findMany({ select: { restaurantId: true } }),
      prisma.table.findMany({ select: { restaurantId: true } }),
    ]);

    expect(items.every((item) => item.restaurantId === restaurant.id)).toBe(
      true,
    );
    expect(tables.every((table) => table.restaurantId === restaurant.id)).toBe(
      true,
    );
  });
});
