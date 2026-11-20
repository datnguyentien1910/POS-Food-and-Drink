import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { SessionService } from '../auth/session.service.js';
import { AppException } from '../common/errors/app.exception.js';
import { sha256Hex } from '../common/security/hash.js';
import type { Device } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { DeviceResponse } from './device.types.js';

interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sessions: SessionService,
  ) {}

  /** Creates a device and returns the one-time plain token for the cookie. */
  async register(
    actor: AuthenticatedUser,
    name: string,
    meta: RequestMeta,
  ): Promise<{ device: DeviceResponse; token: string }> {
    const token = randomBytes(32).toString('base64url');
    const device = await this.prisma.device.create({
      data: {
        restaurantId: actor.restaurantId,
        name,
        tokenHash: sha256Hex(token),
        registeredById: actor.id,
      },
    });

    await this.audit.recordSafe({
      restaurantId: actor.restaurantId,
      actorId: actor.id,
      deviceId: device.id,
      action: 'DEVICE_REGISTERED',
      entity: 'Device',
      entityId: device.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return { device: this.toResponse(device, true), token };
  }

  async list(
    actor: AuthenticatedUser,
    currentToken?: string,
  ): Promise<DeviceResponse[]> {
    const devices = await this.prisma.device.findMany({
      where: { restaurantId: actor.restaurantId },
      orderBy: { createdAt: 'desc' },
    });
    const currentHash =
      currentToken !== undefined ? sha256Hex(currentToken) : undefined;

    return devices.map((device) =>
      this.toResponse(
        device,
        currentHash !== undefined && device.tokenHash === currentHash,
      ),
    );
  }

  /** Revokes a device idempotently and drops its bound sessions. */
  async revoke(
    actor: AuthenticatedUser,
    deviceId: string,
  ): Promise<{ id: string; revokedAt: Date }> {
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, restaurantId: actor.restaurantId },
    });
    if (!device) {
      throw new AppException(
        404,
        'DEVICE_NOT_FOUND',
        'Không tìm thấy thiết bị',
      );
    }
    if (device.revokedAt) {
      return { id: device.id, revokedAt: device.revokedAt };
    }

    const updated = await this.prisma.device.updateMany({
      where: { id: device.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    const current = await this.prisma.device.findUniqueOrThrow({
      where: { id: device.id },
    });

    if (updated.count === 1) {
      await this.sessions.deleteSessionsForDevice(device.id);
      await this.audit.recordSafe({
        restaurantId: actor.restaurantId,
        actorId: actor.id,
        deviceId: device.id,
        action: 'DEVICE_REVOKED',
        entity: 'Device',
        entityId: device.id,
        before: { revokedAt: null },
        after: { revokedAt: current.revokedAt },
      });
    }

    return { id: current.id, revokedAt: current.revokedAt! };
  }

  private toResponse(device: Device, current: boolean): DeviceResponse {
    return {
      id: device.id,
      name: device.name,
      registeredById: device.registeredById,
      lastSeenAt: device.lastSeenAt,
      revokedAt: device.revokedAt,
      createdAt: device.createdAt,
      current,
    };
  }
}
