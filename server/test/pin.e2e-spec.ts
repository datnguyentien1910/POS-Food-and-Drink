import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hashSecret } from '../src/common/security/hash.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { SEED_USERS } from '../src/prisma/seed-data.js';
import { createTestApp } from './helpers/create-test-app.js';
import { resetOperationalData } from './helpers/db.js';

const OWNER = { email: 'owner@restodash.local', password: 'Owner@12345' };
const MANAGER = { email: 'manager@restodash.local', password: 'Manager@12345' };
const CASHIER = { email: 'cashier@restodash.local', password: 'Cashier@12345' };
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

describe('PIN login (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let pinPepper: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    pinPepper = app.get(ConfigService).getOrThrow<string>('PIN_PEPPER');
  });

  beforeEach(async () => {
    await resetOperationalData(prisma);
    // The PIN change tests mutate hashes; restore the seed PINs each time.
    for (const user of SEED_USERS) {
      await prisma.user.update({
        where: { email: user.email },
        data: { pinHash: await hashSecret(user.pin, pinPepper), active: true },
      });
    }
  });

  afterAll(async () => {
    await app.close();
  });

  async function userId(email: string): Promise<string> {
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    return user.id;
  }

  /** Owner password session + a freshly registered device on the same agent. */
  async function deviceAgent() {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/v1/auth/login').send(OWNER).expect(200);
    const created = await agent
      .post('/api/v1/devices')
      .send({ name: 'POS quầy 1' })
      .expect(201);

    const cookies = created.headers['set-cookie'] as unknown as string[];
    const deviceCookie = cookies
      .find((cookie) => cookie.startsWith('restodash.device='))!
      .split(';')[0];

    return { agent, deviceId: created.body.data.id as string, deviceCookie };
  }

  it('lists staff without email or hashes', async () => {
    const { agent } = await deviceAgent();

    const response = await agent.get('/api/v1/auth/staff').expect(200);

    expect(response.body.data).toHaveLength(3);
    for (const member of response.body.data) {
      expect(Object.keys(member).sort()).toEqual(['id', 'name', 'role']);
    }
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('@restodash.local');
    expect(serialized).not.toContain('Hash');
  });

  it('logs in with a valid PIN and starts a 12h session', async () => {
    const { agent } = await deviceAgent();
    const cashierId = await userId(CASHIER.email);
    const before = Date.now();

    const response = await agent
      .post('/api/v1/auth/pin')
      .send({ userId: cashierId, pin: '3456' })
      .expect(200);

    expect(response.body.data.authMethod).toBe('pin');
    expect(response.body.data.user.role).toBe('CASHIER');
    const expiresAt = Date.parse(response.body.data.expiresAt);
    expect(Math.abs(expiresAt - (before + TWELVE_HOURS_MS))).toBeLessThan(10_000);

    const me = await agent.get('/api/v1/auth/me').expect(200);
    expect(me.body.data.user.role).toBe('CASHIER');

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'PIN_LOGIN_SUCCESS' },
    });
    expect(audit?.actorId).toBe(cashierId);
  });

  it('rejects a wrong PIN and audits it with device and actor', async () => {
    const { agent, deviceId } = await deviceAgent();
    const cashierId = await userId(CASHIER.email);

    await agent
      .post('/api/v1/auth/pin')
      .send({ userId: cashierId, pin: '0000' })
      .expect(401)
      .expect((response) => {
        expect(response.body.error.code).toBe('PIN_INVALID');
      });

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'PIN_LOGIN_FAILED' },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorId).toBe(cashierId);
    expect(audit?.deviceId).toBe(deviceId);
  });

  it('validates the PIN format', async () => {
    const { agent } = await deviceAgent();
    const cashierId = await userId(CASHIER.email);

    for (const pin of ['123', '12345', 'abcd']) {
      await agent
        .post('/api/v1/auth/pin')
        .send({ userId: cashierId, pin })
        .expect(400)
        .expect((response) => {
          expect(response.body.error.code).toBe('VALIDATION_ERROR');
        });
    }
  });

  it('rejects PIN login for a user without a PIN', async () => {
    const { agent } = await deviceAgent();
    const managerId = await userId(MANAGER.email);
    await prisma.user.update({
      where: { id: managerId },
      data: { pinHash: null },
    });

    await agent
      .post('/api/v1/auth/pin')
      .send({ userId: managerId, pin: '2345' })
      .expect(401)
      .expect((response) => {
        expect(response.body.error.code).toBe('PIN_INVALID');
      });
  });

  it('changes the PIN and drops other PIN sessions', async () => {
    const { deviceCookie } = await deviceAgent();
    const cashierId = await userId(CASHIER.email);

    const agentA = request.agent(app.getHttpServer());
    const agentB = request.agent(app.getHttpServer());
    await agentA
      .post('/api/v1/auth/pin')
      .set('Cookie', deviceCookie)
      .send({ userId: cashierId, pin: '3456' })
      .expect(200);
    await agentB
      .post('/api/v1/auth/pin')
      .set('Cookie', deviceCookie)
      .send({ userId: cashierId, pin: '3456' })
      .expect(200);

    await agentA
      .post('/api/v1/auth/pin/change')
      .send({ currentPin: '3456', newPin: '4567' })
      .expect(200);

    await agentA.get('/api/v1/auth/me').expect(200);
    await agentB.get('/api/v1/auth/me').expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/auth/pin')
      .set('Cookie', deviceCookie)
      .send({ userId: cashierId, pin: '3456' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/pin')
      .set('Cookie', deviceCookie)
      .send({ userId: cashierId, pin: '4567' })
      .expect(200);

    const audit = await prisma.auditLog.count({
      where: { action: 'PIN_CHANGED' },
    });
    expect(audit).toBe(1);
  });

  it('rejects a wrong current PIN and an unchanged PIN', async () => {
    const { agent, deviceCookie } = await deviceAgent();
    const cashierId = await userId(CASHIER.email);
    await agent
      .post('/api/v1/auth/pin')
      .set('Cookie', deviceCookie)
      .send({ userId: cashierId, pin: '3456' })
      .expect(200);

    await agent
      .post('/api/v1/auth/pin/change')
      .send({ currentPin: '0000', newPin: '4567' })
      .expect(401)
      .expect((response) => {
        expect(response.body.error.code).toBe('PIN_INVALID');
      });

    await agent
      .post('/api/v1/auth/pin/change')
      .send({ currentPin: '3456', newPin: '3456' })
      .expect(400)
      .expect((response) => {
        expect(response.body.error.code).toBe('PIN_UNCHANGED');
      });
  });

  it('changes the PIN from a password session and keeps other password sessions', async () => {
    const agentA = request.agent(app.getHttpServer());
    const agentB = request.agent(app.getHttpServer());
    await agentA.post('/api/v1/auth/login').send(OWNER).expect(200);
    await agentB.post('/api/v1/auth/login').send(OWNER).expect(200);

    await agentA
      .post('/api/v1/auth/pin/change')
      .send({ currentPin: '1234', newPin: '9999' })
      .expect(200);

    await agentB.get('/api/v1/auth/me').expect(200);
  });

  it('drops the open PIN session when the device is revoked', async () => {
    const { agent, deviceId, deviceCookie } = await deviceAgent();
    const cashierId = await userId(CASHIER.email);

    const pinAgent = request.agent(app.getHttpServer());
    await pinAgent
      .post('/api/v1/auth/pin')
      .set('Cookie', deviceCookie)
      .send({ userId: cashierId, pin: '3456' })
      .expect(200);
    await pinAgent.get('/api/v1/auth/me').expect(200);

    await agent.delete(`/api/v1/devices/${deviceId}`).expect(200);

    await pinAgent.get('/api/v1/auth/me').expect(401);
  });
});
