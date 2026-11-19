import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AppException } from '../common/errors/app.exception.js';
import { sha256Hex } from '../common/security/hash.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DEVICE_COOKIE } from './device.constants.js';

const DEVICE_REQUIRED_MESSAGE = 'Thiết bị chưa được đăng ký hoặc không hợp lệ';
const DEVICE_REVOKED_MESSAGE = 'Thiết bị đã bị thu hồi';

/**
 * Resolves the calling device from the `restodash.device` cookie and exposes
 * it on the request. Routes that PIN login or list staff hang off this guard.
 */
@Injectable()
export class DeviceGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.cookies?.[DEVICE_COOKIE];
    if (typeof token !== 'string' || token.length === 0) {
      throw new AppException(401, 'DEVICE_REQUIRED', DEVICE_REQUIRED_MESSAGE);
    }

    const device = await this.prisma.device.findUnique({
      where: { tokenHash: sha256Hex(token) },
    });
    if (!device) {
      throw new AppException(401, 'DEVICE_REQUIRED', DEVICE_REQUIRED_MESSAGE);
    }
    if (device.revokedAt) {
      throw new AppException(401, 'DEVICE_REVOKED', DEVICE_REVOKED_MESSAGE);
    }

    await this.prisma.device.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date() },
    });

    request.device = {
      id: device.id,
      restaurantId: device.restaurantId,
      name: device.name,
    };
    return true;
  }
}
