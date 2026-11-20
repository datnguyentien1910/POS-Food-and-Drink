import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './helpers/create-test-app.js';
import { resetOperationalData } from './helpers/db.js';
import { orderPayload } from './helpers/money.js';

const OWNER = { email: 'owner@restodash.local', password: 'Owner@12345' };
const MANAGER = { email: 'manager@restodash.local', password: 'Manager@12345' };
const CASHIER = { email: 'cashier@restodash.local', password: 'Cashier@12345' };

describe('Audit API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let menuIds: Record<string, string>;
  let ownerId: string;
  let cashierId: string;

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
    ownerId = (await prisma.user.findUniqueOrThrow({ where: { email: OWNER.email } }))
      .id;
    cashierId = (
      await prisma.user.findUniqueOrThrow({ where: { email: CASHIER.email } })
    ).id;

    // 1. A failed password login (actorId null).
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: CASHIER.email, password: 'wrong-password' })
      .expect(401);

    // 2. Owner login + device registration.
    const ownerAgent = request.agent(app.getHttpServer());
    await ownerAgent.post('/api/v1/auth/login').send(OWNER).expect(200);
    const device = await ownerAgent
      .post('/api/v1/devices')
      .send({ name: 'POS audit' })
      .expect(201);
    const deviceCookie = (
      device.headers['set-cookie'] as unknown as string[]
    )
      .find((cookie) => cookie.startsWith('restodash.device='))!
      .split(';')[0];

    // 3. A failed PIN login on that device.
    await request(app.getHttpServer())
      .post('/api/v1/auth/pin')
      .set('Cookie', deviceCookie)
      .send({ userId: cashierId, pin: '0000' })
      .expect(401);

    // 4. Cashier order creation.
    const cashierAgent = request.agent(app.getHttpServer());
    await cashierAgent.post('/api/v1/auth/login').send(CASHIER).expect(200);
    await cashierAgent
      .post('/api/v1/orders')
      .set('Idempotency-Key', 'audit-1')
      .send(
        orderPayload({
          menuIds,
          items: [{ legacyId: 'ga-nuong', qty: 1 }],
          payment: { method: 'CASH', received: 200000 },
        }),
      )
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  async function login(credentials: { email: string; password: string }) {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/v1/auth/login').send(credentials).expect(200);
    return agent;
  }

  it('returns the restaurant audit trail to an owner with pagination', async () => {
    const owner = await login(OWNER);

    const response = await owner.get('/api/v1/audit').expect(200);

    expect(response.body.meta).toMatchObject({ page: 1, limit: 20 });
    const actions = response.body.data.map(
      (entry: { action: string }) => entry.action,
    );
    expect(actions).toEqual(
      expect.arrayContaining([
        'AUTH_LOGIN_SUCCESS',
        'AUTH_LOGIN_FAILED',
        'DEVICE_REGISTERED',
        'PIN_LOGIN_FAILED',
        'ORDER_CREATED',
      ]),
    );
    const withActor = response.body.data.find(
      (entry: { action: string; actor: unknown }) =>
        entry.action === 'ORDER_CREATED',
    );
    expect(withActor.actor).toMatchObject({ id: cashierId, name: 'Thu ngân' });
  });

  it('lets a manager read but forbids a cashier', async () => {
    const manager = await login(MANAGER);
    const cashier = await login(CASHIER);

    await manager.get('/api/v1/audit').expect(200);
    await cashier
      .get('/api/v1/audit')
      .expect(403)
      .expect((response) => {
        expect(response.body.error.code).toBe('FORBIDDEN');
      });
  });

  it('filters by action and actor', async () => {
    const owner = await login(OWNER);

    const byAction = await owner
      .get('/api/v1/audit?action=PIN_LOGIN_FAILED')
      .expect(200);
    expect(byAction.body.data).toHaveLength(1);
    expect(byAction.body.data[0].action).toBe('PIN_LOGIN_FAILED');

    const byActor = await owner
      .get(`/api/v1/audit?actorId=${ownerId}`)
      .expect(200);
    expect(byActor.body.data.length).toBeGreaterThan(0);
    for (const entry of byActor.body.data) {
      expect(entry.actorId).toBe(ownerId);
    }
  });

  it('filters by date and rejects an out-of-range limit', async () => {
    const owner = await login(OWNER);

    const empty = await owner
      .get('/api/v1/audit?from=2999-01-01T00:00:00.000Z')
      .expect(200);
    expect(empty.body.meta.total).toBe(0);
    expect(empty.body.data).toHaveLength(0);

    await owner
      .get('/api/v1/audit?limit=101')
      .expect(400)
      .expect((response) => {
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });
  });

  it('never exposes password, PIN or device secrets', async () => {
    const owner = await login(OWNER);

    const response = await owner.get('/api/v1/audit').expect(200);
    const serialized = JSON.stringify(response.body);

    expect(serialized).not.toContain('passwordHash');
    expect(serialized).not.toContain('pinHash');
    expect(serialized).not.toContain('restodash.device');
    expect(serialized).not.toContain('Owner@12345');
  });
});
