import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { OrderCodeService } from '../src/orders/order-code.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './helpers/create-test-app.js';
import { resetOperationalData } from './helpers/db.js';

describe('Order code (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let service: OrderCodeService;
  let restaurantId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    service = app.get(OrderCodeService, { strict: false });
    const restaurant = await prisma.restaurant.findUniqueOrThrow({
      where: { slug: 'restodash' },
    });
    restaurantId = restaurant.id;
  });

  beforeEach(async () => {
    await resetOperationalData(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  async function next(iso: string) {
    return prisma.$transaction((tx) =>
      service.next(tx, restaurantId, 'Asia/Ho_Chi_Minh', new Date(iso)),
    );
  }

  it('increments within a day and resets across the Vietnamese midnight', async () => {
    expect((await next('2026-11-19T10:00:00Z')).code).toBe('HD-20261119-001');
    expect((await next('2026-11-19T10:00:00Z')).code).toBe('HD-20261119-002');
    expect((await next('2026-11-19T17:00:00Z')).code).toBe('HD-20261120-001');
    expect((await next('2026-11-19T10:00:00Z')).code).toBe('HD-20261119-003');
  });
});
