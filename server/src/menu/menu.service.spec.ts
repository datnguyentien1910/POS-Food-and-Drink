import { describe, expect, it, vi } from 'vitest';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { MenuService } from './menu.service.js';

const ACTOR: AuthenticatedUser = {
  id: 'u-owner',
  name: 'Owner',
  email: 'owner@restodash.local',
  role: 'OWNER',
  restaurantId: 'r1',
};
const META = { ip: '127.0.0.1', userAgent: 'vitest' };

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: 'm1',
    restaurantId: 'r1',
    categoryId: 'c1',
    legacyId: null,
    name: 'Món kiểm thử',
    description: null,
    price: 1000,
    imageKey: null,
    imageUrl: null,
    available: true,
    popular: false,
    sortOrder: 0,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  };
}

function setup() {
  const tx = {
    menuItem: {
      create: vi.fn(async () => item()),
      update: vi.fn(async () => item()),
      delete: vi.fn(async () => item()),
    },
    auditLog: { create: vi.fn(async () => ({})) },
  };
  const prisma = {
    menuItem: {
      findFirst: vi.fn(async () => item()),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    category: { findFirst: vi.fn(async () => ({ id: 'c1' })) },
    $transaction: vi.fn((callback: (client: unknown) => unknown) =>
      callback(tx),
    ),
  };
  const audit = new AuditService(prisma as never);
  const service = new MenuService(prisma as never, audit);
  return { service, prisma, tx };
}

describe('MenuService transactional writes', () => {
  it('creates the item and records MENU_ITEM_CREATED inside one transaction', async () => {
    const { service, prisma, tx } = setup();

    await service.createItem(
      'r1',
      { categoryId: 'c1', name: 'Món mới', price: 5000 } as never,
      ACTOR,
      META,
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.menuItem.create).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.menuItem.create).not.toHaveBeenCalled();
  });

  it('updates the item and records MENU_ITEM_UPDATED inside one transaction', async () => {
    const { service, prisma, tx } = setup();

    await service.updateItem('r1', 'm1', { price: 2000 } as never, ACTOR, META);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.menuItem.update).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.menuItem.update).not.toHaveBeenCalled();
  });

  it('deletes the item and records MENU_ITEM_DELETED inside one transaction', async () => {
    const { service, prisma, tx } = setup();

    await service.deleteItem('r1', 'm1', ACTOR, META);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.menuItem.delete).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.menuItem.delete).not.toHaveBeenCalled();
  });

  it('sets the item image and records the audit inside one transaction', async () => {
    const { service, prisma, tx } = setup();

    await service.setItemImage(
      'r1',
      'm1',
      '/uploads/menu/new.webp',
      ACTOR,
      META,
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.menuItem.update).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.menuItem.update).not.toHaveBeenCalled();
  });
});
