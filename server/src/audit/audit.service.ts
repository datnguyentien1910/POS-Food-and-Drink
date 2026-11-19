import { Injectable, Logger } from '@nestjs/common';
import { Paginated } from '../common/types/api.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuditQueryDto } from './audit-query.dto.js';
import { toAuditResponse, type AuditResponse } from './audit-response.js';
import type { AuditInput } from './audit.types.js';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(
    restaurantId: string,
    query: AuditQueryDto,
  ): Promise<Paginated<AuditResponse>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.AuditLogWhereInput = { restaurantId };
    if (query.action) {
      where.action = query.action;
    }
    if (query.actorId) {
      where.actorId = query.actorId;
    }
    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lt: new Date(query.to) } : {}),
      };
    }

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, name: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return new Paginated(rows.map(toAuditResponse), {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

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
