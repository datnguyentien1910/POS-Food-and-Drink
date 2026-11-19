import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './helpers/create-test-app.js';
import { resetOperationalData } from './helpers/db.js';

const OWNER = { email: 'owner@restodash.local', password: 'Owner@12345' };
const MANAGER = { email: 'manager@restodash.local', password: 'Manager@12345' };
const CASHIER = { email: 'cashier@restodash.local', password: 'Cashier@12345' };

async function login(
  app: INestApplication,
  credentials: { email: string; password: string },
) {
  const agent = request.agent(app.getHttpServer());
  await agent.post('/api/v1/auth/login').send(credentials).expect(200);
  return agent;
}

describe('Devices (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetOperationalData(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers a device without leaking the token', async () => {
    const agent = await login(app, OWNER);

    const response = await agent
      .post('/api/v1/devices')
      .send({ name: 'POS quầy 1' })
      .expect(201);

    expect(response.body.data).toMatchObject({ name: 'POS quầy 1' });
    expect(JSON.stringify(response.body)).not.toContain('tokenHash');
    const cookies = response.headers['set-cookie'] as unknown as string[];
    const deviceCookie = cookies.find((cookie) =>
      cookie.startsWith('restodash.device='),
    );
    expect(deviceCookie).toBeDefined();
    expect(deviceCookie).toContain('HttpOnly');
  });

  it('lists devices and marks the current one', async () => {
    const agent = await login(app, OWNER);
    const created = await agent
      .post('/api/v1/devices')
      .send({ name: 'POS quầy 1' })
      .expect(201);

    const list = await agent.get('/api/v1/devices').expect(200);
    const device = list.body.data.find(
      (entry: { id: string }) => entry.id === created.body.data.id,
    );

    expect(device).toMatchObject({ name: 'POS quầy 1', current: true });
    expect(JSON.stringify(list.body)).not.toContain('tokenHash');
  });

  it('forbids a cashier from registering a device', async () => {
    const agent = await login(app, CASHIER);

    await agent
      .post('/api/v1/devices')
      .send({ name: 'POS quầy 2' })
      .expect(403)
      .expect((response) => {
        expect(response.body.error.code).toBe('FORBIDDEN');
      });
  });

  it('lets a manager register a device', async () => {
    const agent = await login(app, MANAGER);

    await agent
      .post('/api/v1/devices')
      .send({ name: 'POS quầy 3' })
      .expect(201);
  });

  it('revokes a device idempotently', async () => {
    const agent = await login(app, OWNER);
    const created = await agent
      .post('/api/v1/devices')
      .send({ name: 'POS quầy 1' })
      .expect(201);

    const first = await agent
      .delete(`/api/v1/devices/${created.body.data.id}`)
      .expect(200);
    expect(first.body.data.revokedAt).toEqual(expect.any(String));

    const second = await agent
      .delete(`/api/v1/devices/${created.body.data.id}`)
      .expect(200);
    expect(second.body.data.revokedAt).toBe(first.body.data.revokedAt);

    const audit = await prisma.auditLog.count({
      where: { action: 'DEVICE_REVOKED' },
    });
    expect(audit).toBe(1);
  });

  it('rejects staff lookup from a revoked device', async () => {
    const agent = await login(app, OWNER);
    const created = await agent
      .post('/api/v1/devices')
      .send({ name: 'POS quầy 1' })
      .expect(201);

    await agent
      .delete(`/api/v1/devices/${created.body.data.id}`)
      .expect(200);

    await agent
      .get('/api/v1/auth/staff')
      .expect(401)
      .expect((response) => {
        expect(response.body.error.code).toBe('DEVICE_REVOKED');
      });
  });

  it('requires a device cookie for staff lookup', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/auth/staff')
      .expect(401)
      .expect((response) => {
        expect(response.body.error.code).toBe('DEVICE_REQUIRED');
      });
  });

  it('writes DEVICE_REGISTERED audit entries', async () => {
    const agent = await login(app, OWNER);
    await agent
      .post('/api/v1/devices')
      .send({ name: 'POS quầy 1' })
      .expect(201);

    const audit = await prisma.auditLog.count({
      where: { action: 'DEVICE_REGISTERED' },
    });
    expect(audit).toBe(1);
  });
});
