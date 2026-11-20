import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppException } from '../errors/app.exception.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { SessionAuthGuard } from './session-auth.guard.js';

interface FakeSession {
  userId?: string;
  restaurantId?: string;
  role?: string;
  authMethod?: 'password' | 'pin';
  absoluteExpiresAt?: string;
  destroy: (callback: () => void) => void;
}

function createContext(session: FakeSession): {
  context: ExecutionContext;
  request: { session: FakeSession; user?: unknown };
} {
  const request: { session: FakeSession; user?: unknown } = { session };
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

const ACTIVE_USER = {
  id: 'user-1',
  name: 'Chủ quán',
  email: 'owner@restodash.local',
  active: true,
  memberships: [{ restaurantId: 'resto-1', role: 'OWNER' }],
};

describe('SessionAuthGuard', () => {
  let findUnique: ReturnType<typeof vi.fn>;
  let guard: SessionAuthGuard;

  function buildGuard(isPublic = false): SessionAuthGuard {
    const reflector = {
      getAllAndOverride: vi.fn(() => isPublic),
    } as unknown as Reflector;
    return new SessionAuthGuard(reflector, {
      user: { findUnique },
    } as unknown as PrismaService);
  }

  beforeEach(() => {
    findUnique = vi.fn().mockResolvedValue(ACTIVE_USER);
    guard = buildGuard();
  });

  it('lets public routes through without touching the database', async () => {
    const publicGuard = buildGuard(true);
    const { context } = createContext({ destroy: () => {} });

    await expect(publicGuard.canActivate(context)).resolves.toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('rejects requests without a session user', async () => {
    const { context } = createContext({ destroy: () => {} });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('rejects an expired PIN session before querying the database', async () => {
    const { context } = createContext({
      userId: 'user-1',
      authMethod: 'pin',
      absoluteExpiresAt: new Date(Date.now() - 1000).toISOString(),
      destroy: (callback) => callback(),
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      AppException,
    );
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('does not apply the PIN expiry check to password sessions', async () => {
    const { context, request } = createContext({
      userId: 'user-1',
      authMethod: 'password',
      destroy: () => {},
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(findUnique).toHaveBeenCalledOnce();
    expect(request.user).toMatchObject({ id: 'user-1', role: 'OWNER' });
  });

  it('rejects an inactive user', async () => {
    findUnique.mockResolvedValue({ ...ACTIVE_USER, active: false });
    const { context } = createContext({
      userId: 'user-1',
      authMethod: 'password',
      destroy: () => {},
    });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('reads the role from the database, not the session cookie', async () => {
    const { context, request } = createContext({
      userId: 'user-1',
      authMethod: 'password',
      role: 'CASHIER',
      destroy: () => {},
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toMatchObject({ role: 'OWNER' });
  });
});
