import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { AuditService } from '../audit/audit.service.js';
import { clientIp, userAgent } from '../common/http/request.util.js';
import { AppException } from '../common/errors/app.exception.js';
import { hashSecret, verifySecret } from '../common/security/hash.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PASSWORD_SESSION_MS, PIN_SESSION_MS } from './auth.constants.js';
import type {
  AuthenticatedUser,
  LoginResponse,
  StaffMember,
} from './auth.types.js';
import type { DeviceContext } from '../devices/device.types.js';
import { LoginRateLimiter } from './login-rate-limiter.js';
import { SessionService } from './session.service.js';
import type { SessionWithData } from './session.types.js';
import {
  destroySession,
  persistSession,
  regenerateSession,
} from './session.util.js';

type RequestWithSession = Request & {
  session: SessionWithData;
  sessionID?: string;
  user?: AuthenticatedUser;
  logout?: (callback: (error?: unknown) => void) => void;
};

const INVALID_CREDENTIALS = 'Email hoặc mật khẩu không đúng';
const INVALID_PIN = 'PIN không đúng';

@Injectable()
export class AuthService {
  private readonly pinPepper: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly limiter: LoginRateLimiter,
    private readonly sessions: SessionService,
    config: ConfigService,
  ) {
    this.pinPepper = config.getOrThrow<string>('PIN_PEPPER');
  }

  async validatePassword(
    email: string,
    password: string,
  ): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: { memberships: true },
    });

    if (
      !user ||
      !user.active ||
      !(await verifySecret(user.passwordHash, password))
    ) {
      throw new AppException(401, 'INVALID_CREDENTIALS', INVALID_CREDENTIALS);
    }

    const membership = user.memberships[0];
    if (!membership) {
      throw new AppException(401, 'INVALID_CREDENTIALS', INVALID_CREDENTIALS);
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: membership.role,
      restaurantId: membership.restaurantId,
    };
  }

  async createPasswordSession(
    request: RequestWithSession,
    user: AuthenticatedUser,
  ): Promise<LoginResponse> {
    await regenerateSession(request.session);
    const session = request.session;
    session.userId = user.id;
    session.restaurantId = user.restaurantId;
    session.name = user.name;
    session.email = user.email;
    session.role = user.role;
    session.authMethod = 'password';
    delete session.deviceId;
    delete session.absoluteExpiresAt;
    await persistSession(session);

    this.limiter.reset(clientIp(request));
    await this.audit.recordSafe({
      restaurantId: user.restaurantId,
      actorId: user.id,
      action: 'AUTH_LOGIN_SUCCESS',
      entity: 'User',
      entityId: user.id,
      ip: clientIp(request),
      userAgent: userAgent(request),
    });

    return {
      user,
      authMethod: 'password',
      expiresAt: new Date(Date.now() + PASSWORD_SESSION_MS).toISOString(),
    };
  }

  async recordLoginFailure(request: Request): Promise<void> {
    const email =
      typeof request.body?.email === 'string'
        ? request.body.email.trim().toLowerCase()
        : undefined;
    if (!email) {
      return;
    }

    const restaurantId = await this.resolveAuditRestaurantId(email);
    if (!restaurantId) {
      return;
    }

    await this.audit.recordSafe({
      restaurantId,
      action: 'AUTH_LOGIN_FAILED',
      entity: 'User',
      ip: clientIp(request),
      userAgent: userAgent(request),
    });
  }

  /** Active staff of the device's restaurant that can log in with a PIN. */
  async listStaff(restaurantId: string): Promise<StaffMember[]> {
    const users = await this.prisma.user.findMany({
      where: {
        active: true,
        pinHash: { not: null },
        memberships: { some: { restaurantId } },
      },
      include: { memberships: { where: { restaurantId } } },
      orderBy: { name: 'asc' },
    });

    return users.map((user) => ({
      id: user.id,
      name: user.name,
      role: user.memberships[0]?.role ?? 'CASHIER',
    }));
  }

  async loginWithPin(
    request: RequestWithSession,
    device: DeviceContext,
    userId: string,
    pin: string,
  ): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: true },
    });
    const membership = user?.memberships.find(
      (entry) => entry.restaurantId === device.restaurantId,
    );

    const valid =
      !!user?.active &&
      !!user.pinHash &&
      !!membership &&
      (await verifySecret(user.pinHash, pin, this.pinPepper));

    if (!user || !user.active || !user.pinHash || !membership || !valid) {
      await this.audit.recordSafe({
        restaurantId: device.restaurantId,
        actorId: user?.id,
        deviceId: device.id,
        action: 'PIN_LOGIN_FAILED',
        entity: 'User',
        entityId: user?.id,
        ip: clientIp(request),
        userAgent: userAgent(request),
      });
      throw new AppException(401, 'PIN_INVALID', INVALID_PIN);
    }

    return this.createPinSession(request, device, {
      id: user.id,
      name: user.name,
      email: user.email,
      role: membership.role,
      restaurantId: membership.restaurantId,
    });
  }

  async createPinSession(
    request: RequestWithSession,
    device: DeviceContext,
    user: AuthenticatedUser,
  ): Promise<LoginResponse> {
    await regenerateSession(request.session);
    const session = request.session;
    const absoluteExpiresAt = new Date(Date.now() + PIN_SESSION_MS).toISOString();
    session.userId = user.id;
    session.restaurantId = user.restaurantId;
    session.name = user.name;
    session.email = user.email;
    session.role = user.role;
    session.authMethod = 'pin';
    session.deviceId = device.id;
    session.absoluteExpiresAt = absoluteExpiresAt;
    await persistSession(session);

    await this.audit.recordSafe({
      restaurantId: user.restaurantId,
      actorId: user.id,
      deviceId: device.id,
      action: 'PIN_LOGIN_SUCCESS',
      entity: 'User',
      entityId: user.id,
      ip: clientIp(request),
      userAgent: userAgent(request),
    });

    return { user, authMethod: 'pin', expiresAt: absoluteExpiresAt };
  }

  async changePin(
    request: RequestWithSession,
    currentPin: string,
    newPin: string,
  ): Promise<{ success: true }> {
    const actor = request.user;
    if (!actor) {
      throw new AppException(401, 'UNAUTHORIZED', 'Chưa đăng nhập');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: actor.id },
    });
    if (!user || !user.pinHash) {
      throw new AppException(
        400,
        'PIN_NOT_SET',
        'Tài khoản chưa thiết lập PIN',
      );
    }

    if (!(await verifySecret(user.pinHash, currentPin, this.pinPepper))) {
      throw new AppException(401, 'PIN_INVALID', 'PIN hiện tại không đúng');
    }
    if (currentPin === newPin) {
      throw new AppException(
        400,
        'PIN_UNCHANGED',
        'PIN mới phải khác PIN hiện tại',
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { pinHash: await hashSecret(newPin, this.pinPepper) },
    });

    await this.audit.recordSafe({
      restaurantId: actor.restaurantId,
      actorId: actor.id,
      action: 'PIN_CHANGED',
      entity: 'User',
      entityId: actor.id,
      ip: clientIp(request),
      userAgent: userAgent(request),
    });

    await this.sessions.deletePinSessionsForUser(user.id, request.sessionID);

    return { success: true };
  }

  async logout(request: RequestWithSession): Promise<void> {
    if (typeof request.logout === 'function') {
      await new Promise<void>((resolve) => {
        request.logout!(() => resolve());
      });
    }
    await destroySession(request.session);
  }

  private async resolveAuditRestaurantId(
    email: string,
  ): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { memberships: true },
    });
    if (user?.memberships[0]) {
      return user.memberships[0].restaurantId;
    }

    const restaurant = await this.prisma.restaurant.findUnique({
      where: { slug: 'restodash' },
    });
    return restaurant?.id ?? null;
  }
}
