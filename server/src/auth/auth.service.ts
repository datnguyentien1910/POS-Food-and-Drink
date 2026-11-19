import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AuditService } from '../audit/audit.service.js';
import { clientIp, userAgent } from '../common/http/request.util.js';
import { AppException } from '../common/errors/app.exception.js';
import { verifySecret } from '../common/security/hash.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PASSWORD_SESSION_MS } from './auth.constants.js';
import type { AuthenticatedUser, LoginResponse } from './auth.types.js';
import { LoginRateLimiter } from './login-rate-limiter.js';
import type { SessionWithData } from './session.types.js';
import {
  destroySession,
  persistSession,
  regenerateSession,
} from './session.util.js';

type RequestWithSession = Request & {
  session: SessionWithData;
  logout?: (callback: (error?: unknown) => void) => void;
};

const INVALID_CREDENTIALS = 'Email hoặc mật khẩu không đúng';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly limiter: LoginRateLimiter,
  ) {}

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
