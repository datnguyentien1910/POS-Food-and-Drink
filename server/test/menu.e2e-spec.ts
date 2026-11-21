import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './helpers/create-test-app.js';

const CASHIER = { email: 'cashier@restodash.local', password: 'Cashier@12345' };

describe('Menu (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  async function login() {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/v1/auth/login').send(CASHIER).expect(200);
    return agent;
  }

  it('returns categories with their items', async () => {
    const agent = await login();

    const response = await agent.get('/api/v1/menu').expect(200);
    const categories = response.body.data.categories as Array<{
      items: Array<{ legacyId: string; price: number; available: boolean }>;
    }>;

    expect(categories).toHaveLength(6);
    const items = categories.flatMap((category) => category.items);
    expect(items).toHaveLength(16);
    for (const item of items) {
      expect(Number.isInteger(item.price)).toBe(true);
      expect(item.price).toBeGreaterThan(0);
    }

    const gaNuong = items.find((item) => item.legacyId === 'ga-nuong');
    expect(gaNuong).toMatchObject({ price: 109000, available: true });
  });

  it('lists categories sorted by sortOrder without items', async () => {
    const agent = await login();

    const response = await agent.get('/api/v1/menu/categories').expect(200);
    const categories = response.body.data as Array<{
      sortOrder: number;
      items?: unknown;
    }>;

    expect(categories).toHaveLength(6);
    const sortOrders = categories.map((category) => category.sortOrder);
    expect(sortOrders).toEqual([...sortOrders].sort((a, b) => a - b));
    for (const category of categories) {
      expect(category).not.toHaveProperty('items');
    }
  });

  it('includes a nullable imageUrl on every item', async () => {
    const agent = await login();
    const response = await agent.get('/api/v1/menu').expect(200);
    const items = (
      response.body.data.categories as Array<{
        items: Array<Record<string, unknown>>;
      }>
    ).flatMap((category) => category.items);
    for (const item of items) expect(item).toHaveProperty('imageUrl', null);
  });

  it('rejects anonymous access', async () => {
    await request(app.getHttpServer()).get('/api/v1/menu').expect(401);
  });
});
