import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './helpers/create-test-app.js';

const OWNER = { email: 'owner@restodash.local', password: 'Owner@12345' };
const MANAGER = { email: 'manager@restodash.local', password: 'Manager@12345' };
const CASHIER = { email: 'cashier@restodash.local', password: 'Cashier@12345' };

describe('Menu items (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let categoryId: string;
  const createdIds: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const owner = await login(OWNER);
    const response = await owner.get('/api/v1/menu').expect(200);
    categoryId = response.body.data.categories[0].id;
  });

  afterAll(async () => {
    if (createdIds.length > 0) {
      await prisma.menuItem.deleteMany({ where: { id: { in: createdIds } } });
    }
    await app.close();
  });

  async function login(credentials: { email: string; password: string }) {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/v1/auth/login').send(credentials).expect(200);
    return agent;
  }

  function trackItem(response: request.Response): string {
    const id = response.body.data.id as string;
    createdIds.push(id);
    return id;
  }

  async function createItem(
    agent: ReturnType<typeof request.agent>,
    overrides: Record<string, unknown> = {},
  ): Promise<request.Response> {
    return agent
      .post('/api/v1/menu/items')
      .send({
        categoryId,
        name: 'Món kiểm thử',
        price: 129000,
        ...overrides,
      })
      .expect(201);
  }

  it('OWNER creates an item, and it appears in GET /menu', async () => {
    const owner = await login(OWNER);

    const created = await createItem(owner, { name: 'Bún bò kiểm thử' });
    const id = trackItem(created);

    expect(created.body.data).toMatchObject({
      name: 'Bún bò kiểm thử',
      price: 129000,
      imageUrl: null,
    });

    const menu = await owner.get('/api/v1/menu').expect(200);
    const items = (
      menu.body.data.categories as Array<{
        items: Array<{ id: string; price: number }>;
      }>
    ).flatMap((category) => category.items);
    expect(items).toContainEqual(expect.objectContaining({ id, price: 129000 }));
  });

  it('rejects price < 0 and price > 10_000_000 with 400', async () => {
    const owner = await login(OWNER);

    await owner
      .post('/api/v1/menu/items')
      .send({ categoryId, name: 'Giá âm', price: -1 })
      .expect(400);

    await owner
      .post('/api/v1/menu/items')
      .send({ categoryId, name: 'Giá quá lớn', price: 10_000_001 })
      .expect(400);
  });

  it('accepts price = 0', async () => {
    const owner = await login(OWNER);

    const created = await createItem(owner, { name: 'Món miễn phí', price: 0 });
    trackItem(created);
    expect(created.body.data.price).toBe(0);
  });

  it('returns 404 MENU_CATEGORY_NOT_FOUND for an unknown categoryId', async () => {
    const owner = await login(OWNER);

    await owner
      .post('/api/v1/menu/items')
      .send({ categoryId: randomUUID(), name: 'Sai nhóm', price: 1000 })
      .expect(404)
      .expect((response) => {
        expect(response.body.error.code).toBe('MENU_CATEGORY_NOT_FOUND');
      });
  });

  it('returns 404 MENU_CATEGORY_NOT_FOUND for another restaurant category', async () => {
    const owner = await login(OWNER);
    const foreign = await prisma.restaurant.create({
      data: {
        slug: `foreign-${randomUUID()}`,
        name: 'Quán khác',
        categories: { create: { name: 'Nhóm khác' } },
      },
      include: { categories: true },
    });

    try {
      await owner
        .post('/api/v1/menu/items')
        .send({
          categoryId: foreign.categories[0].id,
          name: 'Món quán khác',
          price: 1000,
        })
        .expect(404)
        .expect((response) => {
          expect(response.body.error.code).toBe('MENU_CATEGORY_NOT_FOUND');
        });
    } finally {
      await prisma.restaurant.delete({ where: { id: foreign.id } });
    }
  });

  it('returns 404 MENU_ITEM_NOT_FOUND when updating an unknown id', async () => {
    const owner = await login(OWNER);

    await owner
      .patch(`/api/v1/menu/items/${randomUUID()}`)
      .send({ price: 1000 })
      .expect(404)
      .expect((response) => {
        expect(response.body.error.code).toBe('MENU_ITEM_NOT_FOUND');
      });
  });

  it('MANAGER updates price and GET /menu reflects it', async () => {
    const owner = await login(OWNER);
    const manager = await login(MANAGER);

    const created = await createItem(owner, { name: 'Món đổi giá' });
    const id = trackItem(created);

    await manager
      .patch(`/api/v1/menu/items/${id}`)
      .send({ price: 99000 })
      .expect(200)
      .expect((response) => {
        expect(response.body.data.price).toBe(99000);
      });

    const menu = await manager.get('/api/v1/menu').expect(200);
    const items = (
      menu.body.data.categories as Array<{
        items: Array<{ id: string; price: number }>;
      }>
    ).flatMap((category) => category.items);
    expect(items).toContainEqual(expect.objectContaining({ id, price: 99000 }));
  });

  it('CASHIER cannot create, update or delete', async () => {
    const cashier = await login(CASHIER);

    await cashier
      .post('/api/v1/menu/items')
      .send({ categoryId, name: 'Thu ngân tạo', price: 1000 })
      .expect(403);

    const owner = await login(OWNER);
    const menu = await owner.get('/api/v1/menu').expect(200);
    const items = (
      menu.body.data.categories as Array<{
        items: Array<{ id: string; legacyId: string; price: number }>;
      }>
    ).flatMap((category) => category.items);
    const gaNuong = items.find((item) => item.legacyId === 'ga-nuong')!;

    await cashier
      .patch(`/api/v1/menu/items/${gaNuong.id}`)
      .send({ price: 1 })
      .expect(403);
    await cashier.delete(`/api/v1/menu/items/${gaNuong.id}`).expect(403);

    const after = await owner.get('/api/v1/menu').expect(200);
    const afterItems = (
      after.body.data.categories as Array<{
        items: Array<{ id: string; price: number }>;
      }>
    ).flatMap((category) => category.items);
    expect(afterItems).toContainEqual(
      expect.objectContaining({ id: gaNuong.id, price: 109000 }),
    );
  });

  it('rejects anonymous access', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/menu/items')
      .send({ categoryId, name: 'Khách vãng lai', price: 1000 })
      .expect(401);
  });

  it('deletes an item and records MENU_ITEM_DELETED audit', async () => {
    const owner = await login(OWNER);
    const created = await createItem(owner, { name: 'Món sẽ xoá' });
    const id = trackItem(created);

    await owner.delete(`/api/v1/menu/items/${id}`).expect(204);

    const menu = await owner.get('/api/v1/menu').expect(200);
    const items = (
      menu.body.data.categories as Array<{ items: Array<{ id: string }> }>
    ).flatMap((category) => category.items);
    expect(items.map((item) => item.id)).not.toContain(id);

    const audit = await owner
      .get('/api/v1/audit?action=MENU_ITEM_DELETED&limit=100')
      .expect(200);
    expect(audit.body.data).toHaveLength(1);
    expect(audit.body.data[0]).toMatchObject({
      action: 'MENU_ITEM_DELETED',
      entity: 'MenuItem',
      entityId: id,
    });
  });
});
