import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { LoginRateLimiter } from '../src/auth/login-rate-limiter.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './helpers/create-test-app.js';
import { resetOperationalData } from './helpers/db.js';

const OWNER = { email: 'owner@restodash.local', password: 'Owner@12345' };

describe('Auth password (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let limiter: LoginRateLimiter;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    limiter = app.get(LoginRateLimiter, { strict: false });
  });

  beforeEach(async () => {
    await resetOperationalData(prisma);
    limiter.resetAll();
  });

  afterAll(async () => {
    await app.close();
  });

  it('logs in with the correct password and starts a session', async () => {
    const agent = request.agent(app.getHttpServer());

    const login = await agent
      .post('/api/v1/auth/login')
      .send(OWNER)
      .expect(200);

    expect(login.body.data.user).toMatchObject({
      email: OWNER.email,
      role: 'OWNER',
    });
    expect(login.body.data.authMethod).toBe('password');
    expect(String(login.headers['set-cookie'])).toContain('restodash.sid=');

    const me = await agent.get('/api/v1/auth/me').expect(200);
    expect(me.body.data.user.email).toBe(OWNER.email);
    expect(JSON.stringify(me.body)).not.toContain('passwordHash');
    expect(JSON.stringify(me.body)).not.toContain('pinHash');
  });

  it('rejects a wrong password and records an audit entry', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: OWNER.email, password: 'wrong-password' })
      .expect(401)
      .expect((response) => {
        expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
      });

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'AUTH_LOGIN_FAILED' },
    });
    expect(audit).not.toBeNull();
  });

  it('destroys the session on logout', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/v1/auth/login').send(OWNER).expect(200);

    await agent.post('/api/v1/auth/logout').expect(200);

    await agent
      .get('/api/v1/auth/me')
      .expect(401)
      .expect((response) => {
        expect(response.body.error.code).toBe('UNAUTHORIZED');
      });
  });

  it('rejects /auth/me without a session cookie', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .expect(401)
      .expect((response) => {
        expect(response.body.error.code).toBe('UNAUTHORIZED');
      });
  });

  it('rejects an inactive account even with a valid password', async () => {
    const owner = await prisma.user.findUniqueOrThrow({
      where: { email: OWNER.email },
    });
    await prisma.user.update({
      where: { id: owner.id },
      data: { active: false },
    });

    try {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send(OWNER)
        .expect(401);
    } finally {
      await prisma.user.update({
        where: { id: owner.id },
        data: { active: true },
      });
    }
  });

  it('rate limits the sixth failed attempt from the same ip', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: OWNER.email, password: 'wrong-password' })
        .expect(401);
    }

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: OWNER.email, password: 'wrong-password' })
      .expect(429)
      .expect((response) => {
        expect(response.body.error.code).toBe('RATE_LIMITED');
      });
  });
});
