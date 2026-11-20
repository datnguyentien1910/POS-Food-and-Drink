import { describe, expect, it, vi } from 'vitest';
import { AppException } from '../common/errors/app.exception.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { HealthService } from './health.service.js';

describe('HealthService', () => {
  it('reports the database as up when the query succeeds', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as unknown as PrismaService;
    const service = new HealthService(prisma);

    await expect(service.check()).resolves.toMatchObject({
      status: 'ok',
      db: 'up',
    });
  });

  it('maps a database failure to DB_UNAVAILABLE', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockRejectedValue(new Error('connection refused')),
    } as unknown as PrismaService;
    const service = new HealthService(prisma);

    await expect(service.check()).rejects.toBeInstanceOf(AppException);
    await expect(service.check()).rejects.toMatchObject({
      code: 'DB_UNAVAILABLE',
      status: 503,
    });
  });
});
