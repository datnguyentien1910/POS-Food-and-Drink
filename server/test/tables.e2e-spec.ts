import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './helpers/create-test-app.js';

const CASHIER = { email: 'cashier@restodash.local', password: 'Cashier@12345' };

describe('Tables (e2e)', () => {
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

  it('returns the tables sorted by sortOrder', async () => {
    const agent = await login();

    const response = await agent.get('/api/v1/tables').expect(200);
    const tables = response.body.data as Array<{
      legacyId: string;
      seats: number;
      sortOrder: number;
    }>;

    expect(tables).toHaveLength(12);
    const sortOrders = tables.map((table) => table.sortOrder);
    expect(sortOrders).toEqual([...sortOrders].sort((a, b) => a - b));

    const ban1 = tables.find((table) => table.legacyId === 'ban-1');
    expect(ban1).toBeDefined();
    expect(ban1!.seats).toBeGreaterThan(0);
  });

  it('rejects anonymous access', async () => {
    await request(app.getHttpServer()).get('/api/v1/tables').expect(401);
  });
});
