import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './helpers/create-test-app.js';
import { resetOperationalData } from './helpers/db.js';
import { orderPayload } from './helpers/money.js';

const CASHIER = { email: 'cashier@restodash.local', password: 'Cashier@12345' };

// Seed prices (mirror of src/data/menu.ts): ga-nuong 109000, banh-mi-bo-toi 35000.
// Happy path: 2 × 109000 + 35000 = 253000 subtotal.
const SUBTOTAL = 253000;
const DISCOUNT = 25300;
const TAX = 18216;
const TOTAL = 245916;

function cookieHeader(setCookie: string[] | undefined): string {
  return (setCookie ?? []).map((cookie) => cookie.split(';')[0]).join('; ');
}

describe('Order creation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let menuIds: Record<string, string>;
  let ban1Id: string;
  let ban1Name: string;
  let cashierName: string;

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
    const ban1 = await prisma.table.findFirstOrThrow({
      where: { legacyId: 'ban-1' },
    });
    ban1Id = ban1.id;
    ban1Name = ban1.name;
    cashierName = (
      await prisma.user.findUniqueOrThrow({ where: { email: CASHIER.email } })
    ).name;
  });

  afterAll(async () => {
    await app.close();
  });

  async function login() {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/v1/auth/login').send(CASHIER).expect(200);
    return agent;
  }

  function post(
    agent: ReturnType<typeof request.agent>,
    key: string | null,
    body: Record<string, unknown>,
  ) {
    const req = agent.post('/api/v1/orders');
    if (key !== null) {
      req.set('Idempotency-Key', key);
    }
    return req.send(body);
  }

  it('creates a cash order with server-side pricing and an audit entry', async () => {
    const agent = await login();

    const response = await post(
      agent,
      'happy-1',
      orderPayload({
        menuIds,
        items: [
          { legacyId: 'ga-nuong', qty: 2, note: 'ít cay' },
          { legacyId: 'banh-mi-bo-toi', qty: 1 },
        ],
        tableId: ban1Id,
        discount: { type: 'PERCENT', value: 10 },
        note: 'khách quen',
        payment: { method: 'CASH', received: 500000 },
        clientId: randomUUID(),
      }),
    ).expect(201);

    const order = response.body.data;
    expect(order).toMatchObject({
      status: 'COMPLETED',
      tableId: ban1Id,
      tableName: ban1Name,
      subtotal: SUBTOTAL,
      discountType: 'PERCENT',
      discountValue: 10,
      discountAmount: DISCOUNT,
      tax: TAX,
      total: TOTAL,
      note: 'khách quen',
      cashierName,
      voidedAt: null,
      voidReason: null,
    });
    expect(order.code).toMatch(/^HD-\d{8}-001$/);
    expect(order.payment).toMatchObject({
      method: 'CASH',
      amount: TOTAL,
      received: 500000,
      change: 500000 - TOTAL,
      status: 'COMPLETED',
    });
    expect(order.items).toHaveLength(2);
    expect(
      order.items.find(
        (item: { menuItemId: string }) => item.menuItemId === menuIds['ga-nuong'],
      ),
    ).toMatchObject({
      name: 'Gà nướng',
      unitPrice: 109000,
      qty: 2,
      note: 'ít cay',
    });
    const missing = await prisma.orderItem.findMany({
      where: { menuItemId: null },
    });
    expect(missing).toHaveLength(0);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'ORDER_CREATED' },
    });
    expect(audit?.entityId).toBe(order.id);
    expect(audit?.after).toMatchObject({
      code: order.code,
      total: TOTAL,
      paymentMethod: 'CASH',
    });
  });

  it('requires the Idempotency-Key header', async () => {
    const agent = await login();

    await post(
      agent,
      null,
      orderPayload({
        menuIds,
        items: [{ legacyId: 'ga-nuong', qty: 1 }],
        payment: { method: 'CASH', received: 200000 },
      }),
    )
      .expect(400)
      .expect((response) => {
        expect(response.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
      });

    expect(await prisma.order.count()).toBe(0);
  });

  it('rejects a client-supplied price', async () => {
    const agent = await login();

    await post(agent, 'client-price', {
      ...orderPayload({
        menuIds,
        items: [{ legacyId: 'ga-nuong', qty: 1 }],
        payment: { method: 'CASH', received: 200000 },
      }),
      items: [{ menuItemId: menuIds['ga-nuong'], qty: 1, unitPrice: 1 }],
    })
      .expect(400)
      .expect((response) => {
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

    expect(await prisma.order.count()).toBe(0);
  });

  it('rejects an unavailable or unknown menu item', async () => {
    const agent = await login();

    await prisma.menuItem.update({
      where: { id: menuIds['ga-nuong'] },
      data: { available: false },
    });
    try {
      await post(
        agent,
        'unavailable',
        orderPayload({
          menuIds,
          items: [{ legacyId: 'ga-nuong', qty: 1 }],
          payment: { method: 'CASH', received: 200000 },
        }),
      )
        .expect(400)
        .expect((response) => {
          expect(response.body.error.code).toBe('ORDER_INVALID_ITEM');
        });
    } finally {
      await prisma.menuItem.update({
        where: { id: menuIds['ga-nuong'] },
        data: { available: true },
      });
    }

    await post(agent, 'unknown', {
      items: [{ menuItemId: randomUUID(), qty: 1 }],
      payment: { method: 'CASH', received: 200000 },
    })
      .expect(400)
      .expect((response) => {
        expect(response.body.error.code).toBe('ORDER_INVALID_ITEM');
      });
  });

  it('rejects an unknown table', async () => {
    const agent = await login();

    await post(
      agent,
      'bad-table',
      orderPayload({
        menuIds,
        items: [{ legacyId: 'ga-nuong', qty: 1 }],
        tableId: randomUUID(),
        payment: { method: 'CASH', received: 200000 },
      }),
    )
      .expect(404)
      .expect((response) => {
        expect(response.body.error.code).toBe('TABLE_NOT_FOUND');
      });

    expect(await prisma.order.count()).toBe(0);
  });

  it('rejects short cash and lets the same key succeed on retry', async () => {
    const agent = await login();

    await post(
      agent,
      'cash-retry',
      orderPayload({
        menuIds,
        items: [{ legacyId: 'ga-nuong', qty: 1 }],
        payment: { method: 'CASH', received: 117719 },
      }),
    )
      .expect(400)
      .expect((response) => {
        expect(response.body.error.code).toBe('ORDER_INVALID_PAYMENT');
      });

    expect(await prisma.order.count()).toBe(0);
    // A business failure must not leave a stray idempotency row behind.
    expect(await prisma.idempotencyKey.count()).toBe(0);

    const retry = await post(
      agent,
      'cash-retry',
      orderPayload({
        menuIds,
        items: [{ legacyId: 'ga-nuong', qty: 1 }],
        payment: { method: 'CASH', received: 117720 },
      }),
    ).expect(201);

    expect(retry.body.data.total).toBe(117720);
    expect(await prisma.order.count()).toBe(1);
  });

  it('accepts a transfer without a received amount', async () => {
    const agent = await login();

    const response = await post(
      agent,
      'transfer-1',
      orderPayload({
        menuIds,
        items: [{ legacyId: 'ga-nuong', qty: 1 }],
        payment: { method: 'TRANSFER' },
      }),
    ).expect(201);

    expect(response.body.data.payment).toMatchObject({
      method: 'TRANSFER',
      amount: 117720,
      received: null,
      change: null,
    });
    expect(response.body.data.discountType).toBeNull();
  });

  it('turns a full discount into a zero bill', async () => {
    const agent = await login();

    const response = await post(
      agent,
      'full-discount',
      orderPayload({
        menuIds,
        items: [{ legacyId: 'ga-nuong', qty: 1 }],
        discount: { type: 'PERCENT', value: 100 },
        payment: { method: 'CASH', received: 0 },
      }),
    ).expect(201);

    expect(response.body.data).toMatchObject({
      subtotal: 109000,
      discountAmount: 109000,
      tax: 0,
      total: 0,
    });
    expect(response.body.data.payment).toMatchObject({
      amount: 0,
      received: 0,
      change: 0,
    });
  });

  it('replays the stored response for the same key and payload', async () => {
    const agent = await login();
    const body = orderPayload({
      menuIds,
      items: [{ legacyId: 'ga-nuong', qty: 1 }],
      payment: { method: 'CASH', received: 200000 },
    });

    const first = await post(agent, 'replay-1', body).expect(201);
    const second = await post(agent, 'replay-1', body).expect(201);

    expect(second.body.data).toEqual(first.body.data);
    expect(await prisma.order.count()).toBe(1);
  });

  it('rejects the same key with a different payload', async () => {
    const agent = await login();

    await post(
      agent,
      'conflict-1',
      orderPayload({
        menuIds,
        items: [{ legacyId: 'ga-nuong', qty: 1 }],
        payment: { method: 'CASH', received: 200000 },
      }),
    ).expect(201);

    await post(
      agent,
      'conflict-1',
      orderPayload({
        menuIds,
        items: [{ legacyId: 'ga-nuong', qty: 2 }],
        payment: { method: 'CASH', received: 300000 },
      }),
    )
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
      });

    expect(await prisma.order.count()).toBe(1);
  });

  it('collapses two concurrent requests with the same key into one order', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send(CASHIER)
      .expect(200);
    const cookie = cookieHeader(
      login.headers['set-cookie'] as unknown as string[],
    );
    const body = orderPayload({
      menuIds,
      items: [{ legacyId: 'ga-nuong', qty: 1 }],
      payment: { method: 'CASH', received: 200000 },
    });

    const send = () =>
      request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Cookie', cookie)
        .set('Idempotency-Key', 'parallel-1')
        .send(body);

    const [first, second] = await Promise.all([send(), send()]);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.data.id).toBe(second.body.data.id);
    expect(await prisma.order.count()).toBe(1);
  });

  it('numbers consecutive orders of the same day', async () => {
    const agent = await login();
    const body = orderPayload({
      menuIds,
      items: [{ legacyId: 'ga-nuong', qty: 1 }],
      payment: { method: 'CASH', received: 200000 },
    });

    const first = await post(agent, 'seq-1', body).expect(201);
    const second = await post(agent, 'seq-2', body).expect(201);

    expect(first.body.data.code).toMatch(/-001$/);
    expect(second.body.data.code).toMatch(/-002$/);
  });

  it('names a table-less order as takeaway', async () => {
    const agent = await login();

    const response = await post(
      agent,
      'takeaway-1',
      orderPayload({
        menuIds,
        items: [{ legacyId: 'ga-nuong', qty: 1 }],
        tableId: null,
        payment: { method: 'CASH', received: 200000 },
      }),
    ).expect(201);

    expect(response.body.data.tableId).toBeNull();
    expect(response.body.data.tableName).toBe('Mang đi');
  });
});
