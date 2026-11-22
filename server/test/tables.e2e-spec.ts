import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './helpers/create-test-app.js';

const OWNER = { email: 'owner@restodash.local', password: 'Owner@12345' };
const CASHIER = { email: 'cashier@restodash.local', password: 'Cashier@12345' };

interface TableRow {
  id: string;
  legacyId: string | null;
  name: string;
  seats: number;
  zone: string | null;
  sortOrder: number;
}

describe('Tables (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const createdIds: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Hard-delete everything this suite created so later suites (and the next
    // run) still see exactly the 12 active seeded tables.
    if (createdIds.length > 0) {
      await prisma.table.deleteMany({ where: { id: { in: createdIds } } });
    }
    await app.close();
  });

  async function login(credentials = CASHIER) {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/v1/auth/login').send(credentials).expect(200);
    return agent;
  }

  function trackTable(response: request.Response): string {
    const id = response.body.data.id as string;
    if (!createdIds.includes(id)) createdIds.push(id);
    return id;
  }

  async function getTables(agent: ReturnType<typeof request.agent>) {
    const response = await agent.get('/api/v1/tables').expect(200);
    return response.body.data as TableRow[];
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

  it('OWNER creates a table and GET /tables includes it', async () => {
    const owner = await login(OWNER);

    const created = await owner
      .post('/api/v1/tables')
      .send({
        legacyId: 'e2e-create',
        name: 'Bàn Mới E2E',
        seats: 4,
        zone: 'A',
      })
      .expect(201);
    const id = trackTable(created);

    expect(created.body.data).toMatchObject({
      id,
      legacyId: 'e2e-create',
      name: 'Bàn Mới E2E',
      seats: 4,
      zone: 'A',
      sortOrder: 12,
    });

    const tables = await getTables(owner);
    expect(tables).toContainEqual(expect.objectContaining({ id }));
  });

  it('POST is idempotent by legacyId and updates the same row', async () => {
    const owner = await login(OWNER);

    const first = await owner
      .post('/api/v1/tables')
      .send({ legacyId: 'e2e-idempotent', name: 'Bàn Lặp E2E', seats: 2 })
      .expect(201);
    const id = trackTable(first);

    const second = await owner
      .post('/api/v1/tables')
      .send({
        legacyId: 'e2e-idempotent',
        name: 'Bàn Lặp E2E Đổi',
        seats: 6,
        zone: 'B',
        sortOrder: 30,
      })
      .expect(201);

    expect(second.body.data).toMatchObject({
      id,
      name: 'Bàn Lặp E2E Đổi',
      seats: 6,
      zone: 'B',
      sortOrder: 30,
    });
    const tables = await getTables(owner);
    expect(tables.filter((table) => table.legacyId === 'e2e-idempotent')).toEqual([
      expect.objectContaining({ id, name: 'Bàn Lặp E2E Đổi' }),
    ]);
  });

  it('rejects a duplicate active name with 409 TABLE_NAME_TAKEN', async () => {
    const owner = await login(OWNER);

    const response = await owner
      .post('/api/v1/tables')
      .send({ name: 'bàn 01', seats: 2 })
      .expect(409);

    expect(response.body.error).toMatchObject({
      code: 'TABLE_NAME_TAKEN',
      message: 'Tên bàn đã tồn tại',
    });
  });

  it('rejects invalid seats and empty name with 400', async () => {
    const owner = await login(OWNER);

    await owner
      .post('/api/v1/tables')
      .send({ name: 'Bàn Ghế Sai', seats: 0 })
      .expect(400);
    await owner
      .post('/api/v1/tables')
      .send({ name: 'Bàn Ghế Sai', seats: 51 })
      .expect(400);
    await owner.post('/api/v1/tables').send({ name: '', seats: 2 }).expect(400);
  });

  it('CASHIER cannot create or delete', async () => {
    const cashier = await login(CASHIER);
    const owner = await login(OWNER);

    const created = await owner
      .post('/api/v1/tables')
      .send({ name: 'Bàn Quyền E2E', seats: 2 })
      .expect(201);
    const id = trackTable(created);

    await cashier
      .post('/api/v1/tables')
      .send({ name: 'Bàn Thu Ngân Tạo', seats: 2 })
      .expect(403);
    await cashier.delete(`/api/v1/tables/${id}`).expect(403);

    const tables = await getTables(owner);
    expect(tables).toContainEqual(expect.objectContaining({ id }));
  });

  it('rejects anonymous create/delete', async () => {
    const owner = await login(OWNER);
    const tables = await getTables(owner);
    const id = tables.find((table) => table.legacyId === 'ban-1')!.id;

    await request(app.getHttpServer())
      .post('/api/v1/tables')
      .send({ name: 'Bàn Khách', seats: 2 })
      .expect(401);
    await request(app.getHttpServer())
      .delete(`/api/v1/tables/${id}`)
      .expect(401);
  });

  it('DELETE soft-deletes the table and GET excludes it', async () => {
    const owner = await login(OWNER);
    const before = await getTables(owner);

    const created = await owner
      .post('/api/v1/tables')
      .send({ legacyId: 'e2e-delete', name: 'Bàn Xoá E2E', seats: 2 })
      .expect(201);
    const id = trackTable(created);

    const withTable = await getTables(owner);
    expect(withTable).toContainEqual(expect.objectContaining({ id }));
    expect(withTable).toHaveLength(before.length + 1);

    await owner.delete(`/api/v1/tables/${id}`).expect(204);

    const after = await getTables(owner);
    expect(after.map((table) => table.id)).not.toContain(id);
    expect(after).toHaveLength(before.length);
  });

  it('DELETE is idempotent and returns 404 for an unknown id', async () => {
    const owner = await login(OWNER);

    const created = await owner
      .post('/api/v1/tables')
      .send({ legacyId: 'e2e-delete-twice', name: 'Bàn Xoá Hai Lần', seats: 2 })
      .expect(201);
    const id = trackTable(created);

    await owner.delete(`/api/v1/tables/${id}`).expect(204);
    await owner.delete(`/api/v1/tables/${id}`).expect(204);

    const deletedTable = await prisma.table.findFirst({
      where: { id },
      select: { isActive: true },
    });
    expect(deletedTable?.isActive).toBe(false);

    await owner
      .delete(`/api/v1/tables/${randomUUID()}`)
      .expect(404)
      .expect((response) => {
        expect(response.body.error).toMatchObject({
          code: 'TABLE_NOT_FOUND',
          message: 'Không tìm thấy bàn',
        });
      });
  });

  it('reactivates a soft-deleted table when created again with the same legacyId', async () => {
    const owner = await login(OWNER);

    const created = await owner
      .post('/api/v1/tables')
      .send({
        legacyId: 'e2e-reactivate',
        name: 'Bàn Tái Kích Hoạt',
        seats: 2,
      })
      .expect(201);
    const id = trackTable(created);

    await owner.delete(`/api/v1/tables/${id}`).expect(204);
    let tables = await getTables(owner);
    expect(tables.map((table) => table.id)).not.toContain(id);

    const reactivated = await owner
      .post('/api/v1/tables')
      .send({
        legacyId: 'e2e-reactivate',
        name: 'Bàn Đã Kích Hoạt Lại',
        seats: 8,
      })
      .expect(201);
    expect(reactivated.body.data).toMatchObject({
      id,
      name: 'Bàn Đã Kích Hoạt Lại',
      seats: 8,
    });

    tables = await getTables(owner);
    expect(tables).toContainEqual(
      expect.objectContaining({
        id,
        name: 'Bàn Đã Kích Hoạt Lại',
      }),
    );
  });
});
