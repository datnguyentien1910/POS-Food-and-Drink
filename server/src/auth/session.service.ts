import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Session housekeeping shared by the device and PIN flows. Sessions are
 * stored as JSON by `connect-pg-simple`, so we reach into `sess` with raw
 * SQL instead of pulling in extra models.
 */
@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  /** Drops every PIN session of a user, optionally keeping the current one. */
  async deletePinSessionsForUser(
    userId: string,
    exceptSid?: string,
  ): Promise<void> {
    const keep = exceptSid ?? null;
    await this.prisma.$executeRaw`
      DELETE FROM "session"
      WHERE sess->>'userId' = ${userId}
        AND sess->>'authMethod' = 'pin'
        AND (${keep}::text IS NULL OR sid <> ${keep})
    `;
  }

  /** Drops every session bound to a device (used when a device is revoked). */
  async deleteSessionsForDevice(deviceId: string): Promise<void> {
    await this.prisma.$executeRaw`
      DELETE FROM "session"
      WHERE sess->>'deviceId' = ${deviceId}
    `;
  }
}
