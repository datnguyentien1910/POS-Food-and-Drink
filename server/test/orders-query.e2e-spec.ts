import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './helpers/create-test-app.js';
import { resetOperationalData } from './helpers/db.js';
import { orderPayload } from './helpers/money.js';

const CASHIER = { email: 'cashier@restodash.local', password: 'Cashier@12345' };

describe('Order history (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let menuIds: Record<string, string>;
  let ban1Id: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetOperationalData(prisma);
    const items = await prisma.menuItem.findMany();
    menuIds = Object.fromEntries(
      items
        .filter((item): item is typeof item & { legacyId: string } => !!item.legacyId)
        .map((item) => [item.legacyId, item.id]),
    );
    ban1Id = (
      await prisma.table.findFirstOrThrow({ where: { legacyId: 'ban-1' } })
    ).id;
  });

  afterAll(async () => {
    await app.close();
  });

  async function login() {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/v1/auth/login').send(CASHIER).expect(200);
    return agent;
  }

  async function createOrder(
    agent: ReturnType<typeof request.agent>,
    key: string,
    overrides: { tableId?: string; received?: number } = {},
  ) {
    const response = await agent
      .post('/api/v1/orders')
      .set('Idempotency-Key', key)
      .send(
        orderPayload({
          menuIds,
          items: [{ legacyId: 'ga-nuong', qty: 1 }],
          payment: { method: 'CASH', received: overrides.received ?? 200000 },
          ...(overrides.tableId ? { tableId: overrides.tableId } : {}),
        }),
      )
      .expect(201);
    return response.body.data;
  }

  it('lists orders newest first with pagination metadata', async () => {
    const agent = await login();
    await createOrder(agent, 'q1');
    await createOrder(agent, 'q2');
    const yesterday = await createOrder(agent, 'q3');
    await prisma.order.update({
      where: { id: yesterday.id },
      data: { createdAt: new Date('2026-11-18T05:00:00.000Z') },
    });

    const response = await agent.get('/api/v1/orders').expect(200);

    expect(response.body.meta).toEqual({
      page: 1,
      limit: 20,
      total: 3,
      totalPages: 1,
    });
    expect(response.body.data).toHaveLength(3);
    expect(response.body.data[2].id).toBe(yesterday.id);
  });

  it('paginates with limit and page', async () => {
    const agent = await login();
    await createOrder(agent, 'q1');
    await createOrder(agent, 'q2');
    await createOrder(agent, 'q3');

    const response = await agent.get('/api/v1/orders?limit=1&page=2').expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.meta).toEqual({
      page: 2,
      limit: 1,
      total: 3,
      totalPages: 3,
    });
  });

  it('rejects out-of-range pagination', async () => {
    const agent = await login();

    await agent
      .get('/api/v1/orders?limit=101')
      .expect(400)
      .expect((response) => {
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });
    await agent
      .get('/api/v1/orders?page=0')
      .expect(400)
      .expect((response) => {
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });
  });

  it('filters by status', async () => {
    const agent = await login();
    const order = await createOrder(agent, 'q1');
    await createOrder(agent, 'q2');
    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'VOIDED' },
    });

    const response = await agent.get('/api/v1/orders?status=VOIDED').expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].id).toBe(order.id);
  });

  it('filters by date with an inclusive lower and exclusive upper bound', async () => {
    const agent = await login();
    const today = await createOrder(agent, 'q1');
    const yesterday = await createOrder(agent, 'q2');
    await prisma.order.update({
      where: { id: yesterday.id },
      data: { createdAt: new Date('2026-11-18T05:00:00.000Z') },
    });

    const onlyToday = await agent
      .get('/api/v1/orders?from=2026-11-19T00:00:00.000Z')
      .expect(200);
    expect(onlyToday.body.data.map((order: { id: string }) => order.id)).toEqual([
      today.id,
    ]);

    const onlyYesterday = await agent
      .get('/api/v1/orders?to=2026-11-19T00:00:00.000Z')
      .expect(200);
    expect(onlyYesterday.body.data.map((order: { id: string }) => order.id)).toEqual(
      [yesterday.id],
    );
  });

  it('searches code, table name and cashier name case-insensitively', async () => {
    const agent = await login();
    const order = await createOrder(agent, 'q1', { tableId: ban1Id });

    const byCode = await agent
      .get(`/api/v1/orders?q=${encodeURIComponent(order.code)}`)
      .expect(200);
    expect(byCode.body.data.map((entry: { id: string }) => entry.id)).toContain(
      order.id,
    );

    const byTable = await agent.get('/api/v1/orders?q=BÀN').expect(200);
    expect(byTable.body.data.map((entry: { id: string }) => entry.id)).toContain(
      order.id,
    );

    const byCashier = await agent.get('/api/v1/orders?q=thu ngân').expect(200);
    expect(byCashier.body.data.length).toBeGreaterThan(0);
  });

  it('filters by table and returns the full order on detail', async () => {
    const agent = await login();
    const order = await createOrder(agent, 'q1', { tableId: ban1Id });

    const filtered = await agent
      .get(`/api/v1/orders?tableId=${ban1Id}`)
      .expect(200);
    expect(filtered.body.data.map((entry: { id: string }) => entry.id)).toEqual([
      order.id,
    ]);

    const detail = await agent.get(`/api/v1/orders/${order.id}`).expect(200);
    expect(detail.body.data).toMatchObject({ id: order.id, total: 117720 });
    expect(detail.body.data.items).toHaveLength(1);
    expect(detail.body.data.payment).toMatchObject({
      method: 'CASH',
      amount: 117720,
    });

    await agent.get(`/api/v1/orders/${randomUUID()}`).expect(404);
  });
});
