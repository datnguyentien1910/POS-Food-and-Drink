import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './helpers/create-test-app.js';
import { resetOperationalData } from './helpers/db.js';
import { orderPayload } from './helpers/money.js';

const CASHIER = { email: 'cashier@restodash.local', password: 'Cashier@12345' };
const MANAGER = { email: 'manager@restodash.local', password: 'Manager@12345' };
const REASON = 'Khách đổi ý';

function cookieHeader(setCookie: string[] | undefined): string {
  return (setCookie ?? []).map((cookie) => cookie.split(';')[0]).join('; ');
}

describe('Order void (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let menuIds: Record<string, string>;

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
  });

  afterAll(async () => {
    await app.close();
  });

  async function login(credentials: { email: string; password: string }) {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/v1/auth/login').send(credentials).expect(200);
    return agent;
  }

  async function createOrder(
    agent: ReturnType<typeof request.agent>,
    key: string,
  ) {
    const response = await agent
      .post('/api/v1/orders')
      .set('Idempotency-Key', key)
      .send(
        orderPayload({
          menuIds,
          items: [{ legacyId: 'ga-nuong', qty: 1 }],
          payment: { method: 'CASH', received: 200000 },
        }),
      )
      .expect(201);
    return response.body.data;
  }

  it('forbids a cashier from voiding', async () => {
    const cashier = await login(CASHIER);
    const order = await createOrder(cashier, 'v1');

    await cashier
      .post(`/api/v1/orders/${order.id}/void`)
      .send({ reason: REASON })
      .expect(403)
      .expect((response) => {
        expect(response.body.error.code).toBe('FORBIDDEN');
      });
  });

  it('lets a manager void and audits before/after', async () => {
    const cashier = await login(CASHIER);
    const order = await createOrder(cashier, 'v1');
    const manager = await login(MANAGER);

    const response = await manager
      .post(`/api/v1/orders/${order.id}/void`)
      .send({ reason: REASON })
      .expect(200);

    expect(response.body.data).toMatchObject({
      status: 'VOIDED',
      voidReason: REASON,
    });
    expect(response.body.data.voidedAt).toBeTruthy();
    expect(response.body.data.payment.status).toBe('VOIDED');

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'ORDER_VOIDED', entityId: order.id },
    });
    expect(audit?.before).toMatchObject({ status: 'COMPLETED' });
    expect(audit?.after).toMatchObject({ status: 'VOIDED' });
  });

  it('rejects the second void and keeps a single audit row', async () => {
    const cashier = await login(CASHIER);
    const order = await createOrder(cashier, 'v1');
    const manager = await login(MANAGER);

    await manager
      .post(`/api/v1/orders/${order.id}/void`)
      .send({ reason: REASON })
      .expect(200);
    await manager
      .post(`/api/v1/orders/${order.id}/void`)
      .send({ reason: REASON })
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe('ORDER_ALREADY_VOIDED');
      });

    expect(
      await prisma.auditLog.count({
        where: { action: 'ORDER_VOIDED', entityId: order.id },
      }),
    ).toBe(1);
  });

  it('validates the reason and unknown order id', async () => {
    const cashier = await login(CASHIER);
    const order = await createOrder(cashier, 'v1');
    const manager = await login(MANAGER);

    await manager
      .post(`/api/v1/orders/${randomUUID()}/void`)
      .send({ reason: REASON })
      .expect(404);

    for (const reason of ['', 'ab']) {
      await manager
        .post(`/api/v1/orders/${order.id}/void`)
        .send({ reason })
        .expect(400)
        .expect((response) => {
          expect(response.body.error.code).toBe('VALIDATION_ERROR');
        });
    }
  });

  it('voids exactly once under concurrent requests', async () => {
    const cashier = await login(CASHIER);
    const order = await createOrder(cashier, 'v1');
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send(MANAGER)
      .expect(200);
    const cookie = cookieHeader(
      loginResponse.headers['set-cookie'] as unknown as string[],
    );

    const voidOrder = () =>
      request(app.getHttpServer())
        .post(`/api/v1/orders/${order.id}/void`)
        .set('Cookie', cookie)
        .send({ reason: REASON });

    const [first, second] = await Promise.all([voidOrder(), voidOrder()]);
    expect([first.status, second.status].sort((a, b) => a - b)).toEqual([
      200, 409,
    ]);
    expect(
      await prisma.auditLog.count({
        where: { action: 'ORDER_VOIDED', entityId: order.id },
      }),
    ).toBe(1);
  });
});
