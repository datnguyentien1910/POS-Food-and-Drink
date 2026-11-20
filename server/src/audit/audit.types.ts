import type { AuditAction } from '../generated/prisma/enums.js';

export interface AuditInput {
  restaurantId: string;
  actorId?: string;
  deviceId?: string;
  action: AuditAction;
  entity?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
  userAgent?: string;
}
