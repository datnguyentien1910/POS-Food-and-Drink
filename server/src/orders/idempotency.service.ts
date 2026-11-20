import { Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception.js';
import { sha256Hex } from '../common/security/hash.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface IdempotentExecution<T> {
  restaurantId: string;
  endpoint: string;
  key: string;
  payload: unknown;
  statusCode: number;
  handler: (tx: Prisma.TransactionClient) => Promise<T>;
}

const CONFLICT_MESSAGE = 'Idempotency-Key đã dùng với dữ liệu khác';

/** Deterministic JSON so the same payload always hashes the same way. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortValue(entry));
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([left], [right]) => left.localeCompare(right),
    );
    return Object.fromEntries(
      entries.map(([key, entry]) => [key, sortValue(entry)]),
    );
  }
  return value;
}

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Runs `handler` once per `(restaurantId, endpoint, key)`. Replays with the
   * same payload return the stored response; a different payload is a 409.
   */
  async execute<T>(input: IdempotentExecution<T>): Promise<T> {
    const requestHash = sha256Hex(stableStringify(input.payload));
    const where = {
      restaurantId_endpoint_key: {
        restaurantId: input.restaurantId,
        endpoint: input.endpoint,
        key: input.key,
      },
    };

    const existing = await this.prisma.idempotencyKey.findUnique({ where });
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new AppException(409, 'IDEMPOTENCY_CONFLICT', CONFLICT_MESSAGE);
      }
      return existing.responseJson as T;
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const value = await input.handler(tx);
        await tx.idempotencyKey.create({
          data: {
            restaurantId: input.restaurantId,
            endpoint: input.endpoint,
            key: input.key,
            requestHash,
            statusCode: input.statusCode,
            responseJson: value as Prisma.InputJsonValue,
          },
        });
        return value;
      });
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
      // Another request with the same key won the race; replay its response.
      const winner = await this.prisma.idempotencyKey.findUnique({ where });
      if (!winner) {
        throw error;
      }
      if (winner.requestHash !== requestHash) {
        throw new AppException(409, 'IDEMPOTENCY_CONFLICT', CONFLICT_MESSAGE);
      }
      return winner.responseJson as T;
    }
  }
}
