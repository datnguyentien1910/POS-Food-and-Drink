import type { AuditLog } from '../generated/prisma/client.js';
import type { AuditAction } from '../generated/prisma/enums.js';

export interface AuditActor {
  id: string;
  name: string;
}

export interface AuditResponse {
  id: string;
  action: AuditAction;
  entity: string | null;
  entityId: string | null;
  actorId: string | null;
  actor: AuditActor | null;
  deviceId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export type AuditWithActor = AuditLog & { actor: AuditActor | null };

/** Public audit shape; diffs stay raw JSON and secrets are never present. */
export function toAuditResponse(log: AuditWithActor): AuditResponse {
  return {
    id: log.id,
    action: log.action,
    entity: log.entity,
    entityId: log.entityId,
    actorId: log.actorId,
    actor: log.actor,
    deviceId: log.deviceId,
    before: log.before,
    after: log.after,
    ip: log.ip,
    userAgent: log.userAgent,
    createdAt: log.createdAt,
  };
}
