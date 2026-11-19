import type { PrismaClient } from '../../src/generated/prisma/client.js';

/**
 * Clears everything the e2e suites create while keeping the seeded
 * restaurant, users, categories, menu items and tables in place.
 */
export async function resetOperationalData(
  prisma: PrismaClient,
): Promise<void> {
  await prisma.$transaction([
    prisma.orderItem.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.order.deleteMany(),
    prisma.idempotencyKey.deleteMany(),
    prisma.orderCounter.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.device.deleteMany(),
  ]);
  await prisma.$executeRawUnsafe('DELETE FROM "session"');
}
