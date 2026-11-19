import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './helpers/create-test-app.js';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the health payload inside the response envelope', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);

    expect(response.body.data).toMatchObject({ status: 'ok', db: 'up' });
    expect(response.body.data.uptime).toEqual(expect.any(Number));
    expect(response.body.data.version).toEqual(expect.any(String));
  });

  it('returns a NOT_FOUND error envelope for unknown routes', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/khong-ton-tai')
      .expect(404);

    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('rejects unsafe requests from an untrusted origin', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/health')
      .set('Origin', 'https://evil.example')
      .expect(403);

    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('allows unsafe requests without an Origin header through to routing', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/unknown')
      .expect(404);

    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
