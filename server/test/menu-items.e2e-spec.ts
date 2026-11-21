import { randomUUID } from 'node:crypto';
import { access, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './helpers/create-test-app.js';
import { resetOperationalData } from './helpers/db.js';

const OWNER = { email: 'owner@restodash.local', password: 'Owner@12345' };
const MANAGER = { email: 'manager@restodash.local', password: 'Manager@12345' };
const CASHIER = { email: 'cashier@restodash.local', password: 'Cashier@12345' };

describe('Menu items (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let categoryId: string;
  const createdIds: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await resetOperationalData(prisma);
    await prisma.menuItem.deleteMany({ where: { legacyId: null } });

    const owner = await login(OWNER);
    const response = await owner.get('/api/v1/menu').expect(200);
    categoryId = response.body.data.categories[0].id;
  });

  afterAll(async () => {
    if (createdIds.length > 0) {
      await prisma.menuItem.deleteMany({ where: { id: { in: createdIds } } });
    }
    await rm(uploadRoot(), { recursive: true, force: true });
    await app.close();
  });

  function uploadRoot(): string {
    return process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');
  }

  async function uploadedFiles(): Promise<string[]> {
    try {
      return await readdir(path.join(uploadRoot(), 'menu'));
    } catch {
      return [];
    }
  }

  async function login(credentials: { email: string; password: string }) {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/v1/auth/login').send(credentials).expect(200);
    return agent;
  }

  function trackItem(response: request.Response): string {
    const id = response.body.data.id as string;
    createdIds.push(id);
    return id;
  }

  async function createItem(
    agent: ReturnType<typeof request.agent>,
    overrides: Record<string, unknown> = {},
  ): Promise<request.Response> {
    return agent
      .post('/api/v1/menu/items')
      .send({
        categoryId,
        name: 'Món kiểm thử',
        price: 129000,
        ...overrides,
      })
      .expect(201);
  }

  it('OWNER creates an item, and it appears in GET /menu', async () => {
    const owner = await login(OWNER);

    const created = await createItem(owner, { name: 'Bún bò kiểm thử' });
    const id = trackItem(created);

    expect(created.body.data).toMatchObject({
      name: 'Bún bò kiểm thử',
      price: 129000,
      imageUrl: null,
    });

    const menu = await owner.get('/api/v1/menu').expect(200);
    const items = (
      menu.body.data.categories as Array<{
        items: Array<{ id: string; price: number }>;
      }>
    ).flatMap((category) => category.items);
    expect(items).toContainEqual(expect.objectContaining({ id, price: 129000 }));
  });

  it('rejects price < 0 and price > 10_000_000 with 400', async () => {
    const owner = await login(OWNER);

    await owner
      .post('/api/v1/menu/items')
      .send({ categoryId, name: 'Giá âm', price: -1 })
      .expect(400);

    await owner
      .post('/api/v1/menu/items')
      .send({ categoryId, name: 'Giá quá lớn', price: 10_000_001 })
      .expect(400);
  });

  it('accepts price = 0', async () => {
    const owner = await login(OWNER);

    const created = await createItem(owner, { name: 'Món miễn phí', price: 0 });
    trackItem(created);
    expect(created.body.data.price).toBe(0);
  });

  it('returns 404 MENU_CATEGORY_NOT_FOUND for an unknown categoryId', async () => {
    const owner = await login(OWNER);

    await owner
      .post('/api/v1/menu/items')
      .send({ categoryId: randomUUID(), name: 'Sai nhóm', price: 1000 })
      .expect(404)
      .expect((response) => {
        expect(response.body.error.code).toBe('MENU_CATEGORY_NOT_FOUND');
      });
  });

  it('returns 404 MENU_CATEGORY_NOT_FOUND for another restaurant category', async () => {
    const owner = await login(OWNER);
    const foreign = await prisma.restaurant.create({
      data: {
        slug: `foreign-${randomUUID()}`,
        name: 'Quán khác',
        categories: { create: { name: 'Nhóm khác' } },
      },
      include: { categories: true },
    });

    try {
      await owner
        .post('/api/v1/menu/items')
        .send({
          categoryId: foreign.categories[0].id,
          name: 'Món quán khác',
          price: 1000,
        })
        .expect(404)
        .expect((response) => {
          expect(response.body.error.code).toBe('MENU_CATEGORY_NOT_FOUND');
        });
    } finally {
      await prisma.restaurant.delete({ where: { id: foreign.id } });
    }
  });

  it('returns 404 MENU_ITEM_NOT_FOUND when updating an unknown id', async () => {
    const owner = await login(OWNER);

    await owner
      .patch(`/api/v1/menu/items/${randomUUID()}`)
      .send({ price: 1000 })
      .expect(404)
      .expect((response) => {
        expect(response.body.error.code).toBe('MENU_ITEM_NOT_FOUND');
      });
  });

  it('MANAGER updates price and GET /menu reflects it', async () => {
    const owner = await login(OWNER);
    const manager = await login(MANAGER);

    const created = await createItem(owner, { name: 'Món đổi giá' });
    const id = trackItem(created);

    await manager
      .patch(`/api/v1/menu/items/${id}`)
      .send({ price: 99000 })
      .expect(200)
      .expect((response) => {
        expect(response.body.data.price).toBe(99000);
      });

    const menu = await manager.get('/api/v1/menu').expect(200);
    const items = (
      menu.body.data.categories as Array<{
        items: Array<{ id: string; price: number }>;
      }>
    ).flatMap((category) => category.items);
    expect(items).toContainEqual(expect.objectContaining({ id, price: 99000 }));
  });

  it('CASHIER cannot create, update or delete', async () => {
    const cashier = await login(CASHIER);

    await cashier
      .post('/api/v1/menu/items')
      .send({ categoryId, name: 'Thu ngân tạo', price: 1000 })
      .expect(403);

    const owner = await login(OWNER);
    const menu = await owner.get('/api/v1/menu').expect(200);
    const items = (
      menu.body.data.categories as Array<{
        items: Array<{ id: string; legacyId: string; price: number }>;
      }>
    ).flatMap((category) => category.items);
    const gaNuong = items.find((item) => item.legacyId === 'ga-nuong')!;

    await cashier
      .patch(`/api/v1/menu/items/${gaNuong.id}`)
      .send({ price: 1 })
      .expect(403);
    await cashier.delete(`/api/v1/menu/items/${gaNuong.id}`).expect(403);

    const after = await owner.get('/api/v1/menu').expect(200);
    const afterItems = (
      after.body.data.categories as Array<{
        items: Array<{ id: string; price: number }>;
      }>
    ).flatMap((category) => category.items);
    expect(afterItems).toContainEqual(
      expect.objectContaining({ id: gaNuong.id, price: 109000 }),
    );
  });

  it('rejects anonymous access', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/menu/items')
      .send({ categoryId, name: 'Khách vãng lai', price: 1000 })
      .expect(401);
  });

  it('uploads a webp image and exposes imageUrl', async () => {
    const owner = await login(OWNER);
    const created = await createItem(owner, { name: 'Món có ảnh' });
    const id = trackItem(created);

    const upload = await owner
      .post(`/api/v1/menu/items/${id}/image`)
      .attach('file', Buffer.from('fake-webp-bytes'), {
        filename: 'a.webp',
        contentType: 'image/webp',
      })
      .expect(200);

    const imageUrl = upload.body.data.imageUrl as string;
    expect(imageUrl).toMatch(/^\/uploads\/menu\/[0-9a-f-]+\.webp$/);
    const filename = path.basename(imageUrl);
    expect(await uploadedFiles()).toContain(filename);

    const menu = await owner.get('/api/v1/menu').expect(200);
    const items = (
      menu.body.data.categories as Array<{
        items: Array<{ id: string; imageUrl: string | null }>;
      }>
    ).flatMap((category) => category.items);
    expect(items).toContainEqual(
      expect.objectContaining({ id, imageUrl }),
    );

    await request(app.getHttpServer()).get(imageUrl).expect(200);
  });

  it('rejects a non-image upload with 400 IMAGE_INVALID_TYPE and writes no file', async () => {
    const owner = await login(OWNER);
    const created = await createItem(owner, { name: 'Món ảnh sai loại' });
    const id = trackItem(created);
    const before = await uploadedFiles();

    await owner
      .post(`/api/v1/menu/items/${id}/image`)
      .attach('file', Buffer.from('not an image'), {
        filename: 'a.txt',
        contentType: 'text/plain',
      })
      .expect(400)
      .expect((response) => {
        expect(response.body.error.code).toBe('IMAGE_INVALID_TYPE');
      });

    expect(await uploadedFiles()).toEqual(before);
  });

  it('rejects an image larger than 2MB with 400 IMAGE_TOO_LARGE and writes no file', async () => {
    const owner = await login(OWNER);
    const created = await createItem(owner, { name: 'Món ảnh quá lớn' });
    const id = trackItem(created);
    const before = await uploadedFiles();

    await owner
      .post(`/api/v1/menu/items/${id}/image`)
      .attach('file', Buffer.alloc(2 * 1024 * 1024 + 1), {
        filename: 'big.png',
        contentType: 'image/png',
      })
      .expect(400)
      .expect((response) => {
        expect(response.body.error.code).toBe('IMAGE_TOO_LARGE');
      });

    expect(await uploadedFiles()).toEqual(before);
  });

  it('replaces the previous uploaded image file', async () => {
    const owner = await login(OWNER);
    const created = await createItem(owner, { name: 'Món đổi ảnh' });
    const id = trackItem(created);

    const first = await owner
      .post(`/api/v1/menu/items/${id}/image`)
      .attach('file', Buffer.from('first'), {
        filename: 'first.webp',
        contentType: 'image/webp',
      })
      .expect(200);
    const firstPath = path.join(
      uploadRoot(),
      'menu',
      path.basename(first.body.data.imageUrl as string),
    );

    const second = await owner
      .post(`/api/v1/menu/items/${id}/image`)
      .attach('file', Buffer.from('second'), {
        filename: 'second.webp',
        contentType: 'image/webp',
      })
      .expect(200);
    const secondPath = path.join(
      uploadRoot(),
      'menu',
      path.basename(second.body.data.imageUrl as string),
    );

    await expect(access(firstPath)).rejects.toThrow();
    await expect(access(secondPath)).resolves.toBeUndefined();
  });

  it('writes no orphan file when uploading to an unknown item', async () => {
    const owner = await login(OWNER);
    const before = await uploadedFiles();

    await owner
      .post(`/api/v1/menu/items/${randomUUID()}/image`)
      .attach('file', Buffer.from('orphan'), {
        filename: 'orphan.webp',
        contentType: 'image/webp',
      })
      .expect(404)
      .expect((response) => {
        expect(response.body.error.code).toBe('MENU_ITEM_NOT_FOUND');
      });

    expect(await uploadedFiles()).toEqual(before);
  });

  it('deletes an item, removes its image file, and records MENU_ITEM_DELETED audit', async () => {
    const owner = await login(OWNER);
    const created = await createItem(owner, { name: 'Món sẽ xoá' });
    const id = trackItem(created);

    const upload = await owner
      .post(`/api/v1/menu/items/${id}/image`)
      .attach('file', Buffer.from('bytes'), {
        filename: 'delete-me.webp',
        contentType: 'image/webp',
      })
      .expect(200);
    const storedPath = path.join(
      uploadRoot(),
      'menu',
      path.basename(upload.body.data.imageUrl as string),
    );
    await expect(access(storedPath)).resolves.toBeUndefined();

    await owner.delete(`/api/v1/menu/items/${id}`).expect(204);

    await expect(access(storedPath)).rejects.toThrow();

    const menu = await owner.get('/api/v1/menu').expect(200);
    const items = (
      menu.body.data.categories as Array<{ items: Array<{ id: string }> }>
    ).flatMap((category) => category.items);
    expect(items.map((item) => item.id)).not.toContain(id);

    const audit = await owner
      .get('/api/v1/audit?action=MENU_ITEM_DELETED&limit=100')
      .expect(200);
    expect(audit.body.data).toHaveLength(1);
    expect(audit.body.data[0]).toMatchObject({
      action: 'MENU_ITEM_DELETED',
      entity: 'MenuItem',
      entityId: id,
    });
  });

  it('includes categoryId on created items and in GET /menu', async () => {
    const owner = await login(OWNER);
    const created = await createItem(owner, { name: 'Món có nhóm' });
    const id = trackItem(created);

    expect(created.body.data.categoryId).toBe(categoryId);

    const menu = await owner.get('/api/v1/menu').expect(200);
    const items = (
      menu.body.data.categories as Array<{
        items: Array<{ id: string; categoryId: string }>;
      }>
    ).flatMap((category) => category.items);
    expect(items).toContainEqual(expect.objectContaining({ id, categoryId }));
  });

  it('stores an empty description as null', async () => {
    const owner = await login(OWNER);

    const blank = await createItem(owner, {
      name: 'Món mô tả rỗng',
      description: '',
    });
    trackItem(blank);
    expect(blank.body.data.description).toBeNull();

    const spaces = await createItem(owner, {
      name: 'Món mô tả khoảng trắng',
      description: '   ',
    });
    trackItem(spaces);
    expect(spaces.body.data.description).toBeNull();
  });

  it('clears a description when updated to empty', async () => {
    const owner = await login(OWNER);
    const created = await createItem(owner, {
      name: 'Món có mô tả',
      description: 'Ngon',
    });
    const id = trackItem(created);
    expect(created.body.data.description).toBe('Ngon');

    await owner
      .patch(`/api/v1/menu/items/${id}`)
      .send({ description: '' })
      .expect(200)
      .expect((response) => {
        expect(response.body.data.description).toBeNull();
      });
  });

  it('returns 400 IMAGE_REQUIRED when the upload has no file', async () => {
    const owner = await login(OWNER);
    const created = await createItem(owner, { name: 'Món thiếu ảnh' });
    const id = trackItem(created);

    await owner
      .post(`/api/v1/menu/items/${id}/image`)
      .expect(400)
      .expect((response) => {
        expect(response.body.error.code).toBe('IMAGE_REQUIRED');
      });
  });

  it('records MENU_ITEM_CREATED with the created item as after', async () => {
    const owner = await login(OWNER);
    const created = await createItem(owner, {
      name: 'Món ghi audit tạo',
      description: 'Mô tả',
    });
    const id = trackItem(created);

    const audit = await owner
      .get('/api/v1/audit?action=MENU_ITEM_CREATED&limit=100')
      .expect(200);
    const entry = (
      audit.body.data as Array<{ entityId: string }>
    ).find((log) => log.entityId === id);

    expect(entry).toMatchObject({
      action: 'MENU_ITEM_CREATED',
      entity: 'MenuItem',
      entityId: id,
      before: null,
      after: expect.objectContaining({ id, name: 'Món ghi audit tạo' }),
    });
  });

  it('records MENU_ITEM_UPDATED with before and after', async () => {
    const owner = await login(OWNER);
    const created = await createItem(owner, {
      name: 'Món ghi audit sửa',
      price: 50000,
    });
    const id = trackItem(created);

    await owner
      .patch(`/api/v1/menu/items/${id}`)
      .send({ price: 60000 })
      .expect(200);

    const audit = await owner
      .get('/api/v1/audit?action=MENU_ITEM_UPDATED&limit=100')
      .expect(200);
    const entry = (
      audit.body.data as Array<{ entityId: string }>
    ).find((log) => log.entityId === id);

    expect(entry).toMatchObject({
      entityId: id,
      before: expect.objectContaining({ price: 50000 }),
      after: expect.objectContaining({ price: 60000 }),
    });
  });

  it('returns 404 MENU_CATEGORY_NOT_FOUND updating to another restaurant category', async () => {
    const owner = await login(OWNER);
    const created = await createItem(owner, { name: 'Món đổi nhóm lạ' });
    const id = trackItem(created);
    const foreign = await prisma.restaurant.create({
      data: {
        slug: `foreign-${randomUUID()}`,
        name: 'Quán khác khi sửa',
        categories: { create: { name: 'Nhóm khác' } },
      },
      include: { categories: true },
    });

    try {
      await owner
        .patch(`/api/v1/menu/items/${id}`)
        .send({ categoryId: foreign.categories[0].id })
        .expect(404)
        .expect((response) => {
          expect(response.body.error.code).toBe('MENU_CATEGORY_NOT_FOUND');
        });
    } finally {
      await prisma.restaurant.delete({ where: { id: foreign.id } });
    }
  });

  it('CASHIER cannot upload an item image', async () => {
    const owner = await login(OWNER);
    const cashier = await login(CASHIER);
    const created = await createItem(owner, { name: 'Món ảnh thu ngân' });
    const id = trackItem(created);
    const before = await uploadedFiles();

    await cashier
      .post(`/api/v1/menu/items/${id}/image`)
      .attach('file', Buffer.from('bytes'), {
        filename: 'cashier.webp',
        contentType: 'image/webp',
      })
      .expect(403);

    expect(await uploadedFiles()).toEqual(before);
  });
});
