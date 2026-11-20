import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../../auth/auth.types.js';
import type { SessionWithData } from '../../auth/session.types.js';
import { destroySession } from '../../auth/session.util.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { AppException } from '../errors/app.exception.js';
import { PrismaService } from '../../prisma/prisma.service.js';

type RequestWithSession = Request & {
  user?: AuthenticatedUser;
  session: SessionWithData;
};

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithSession>();
    const session = request.session;
    const userId = session?.userId;
    if (!userId) {
      throw new AppException(
        401,
        'UNAUTHORIZED',
        'Chưa đăng nhập hoặc phiên đã hết hạn',
      );
    }

    if (
      session.authMethod === 'pin' &&
      session.absoluteExpiresAt &&
      Date.parse(session.absoluteExpiresAt) <= Date.now()
    ) {
      await destroySession(session);
      throw new AppException(401, 'UNAUTHORIZED', 'Phiên PIN đã hết hạn');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: true },
    });
    if (!user || !user.active) {
      throw new AppException(
        401,
        'UNAUTHORIZED',
        'Tài khoản không hợp lệ hoặc đã bị khoá',
      );
    }

    const membership = session.restaurantId
      ? user.memberships.find(
          (entry) => entry.restaurantId === session.restaurantId,
        )
      : user.memberships[0];
    if (!membership) {
      throw new AppException(
        401,
        'UNAUTHORIZED',
        'Tài khoản không thuộc nhà hàng nào',
      );
    }

    request.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: membership.role,
      restaurantId: membership.restaurantId,
    };

    return true;
  }
}
