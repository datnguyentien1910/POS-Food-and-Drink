import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuditInput } from './audit.types.js';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(
    input: AuditInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.auditLog.create({
      data: {
        restaurantId: input.restaurantId,
        actorId: input.actorId ?? null,
        deviceId: input.deviceId ?? null,
        action: input.action,
        entity: input.entity ?? null,
        entityId: input.entityId ?? null,
        before: (input.before as Prisma.InputJsonValue) ?? undefined,
        after: (input.after as Prisma.InputJsonValue) ?? undefined,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  }

  /**
   * Best-effort write for authentication paths: a failed audit must never
   * change the API outcome or leak internals.
   */
  async recordSafe(
    input: AuditInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    try {
      await this.record(input, tx);
    } catch (error) {
      this.logger.warn(
        `Audit write failed for ${input.action}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
