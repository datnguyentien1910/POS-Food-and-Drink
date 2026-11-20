import { describe, expect, it, vi } from 'vitest';
import { AppException } from '../common/errors/app.exception.js';
import { sha256Hex } from '../common/security/hash.js';
import { IdempotencyService, stableStringify } from './idempotency.service.js';

const PAYLOAD = {
  items: [{ menuItemId: 'm1', qty: 2 }],
  payment: { method: 'CASH', received: 500000 },
};
const HASH = sha256Hex(stableStringify(PAYLOAD));

function setup() {
  const tx = { idempotencyKey: { create: vi.fn().mockResolvedValue({}) } };
  const prisma = {
    idempotencyKey: { findUnique: vi.fn().mockResolvedValue(null) },
    $transaction: vi.fn((callback: (client: unknown) => unknown) =>
      callback(tx),
    ),
  };
  const service = new IdempotencyService(prisma as never);
  const handler = vi.fn().mockResolvedValue({ id: 'order-1' });
  const input = {
    restaurantId: 'resto-1',
    endpoint: 'POST /orders',
    key: 'key-1',
    payload: PAYLOAD,
    statusCode: 201,
    handler,
  };
  return { service, prisma, tx, handler, input };
}

describe('IdempotencyService', () => {
  it('runs the handler and stores the response for a new key', async () => {
    const { service, prisma, tx, handler, input } = setup();

    await expect(service.execute(input)).resolves.toEqual({ id: 'order-1' });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(tx.idempotencyKey.create).toHaveBeenCalledTimes(1);
    expect(tx.idempotencyKey.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        restaurantId: 'resto-1',
        endpoint: 'POST /orders',
        key: 'key-1',
        requestHash: HASH,
        statusCode: 201,
      }),
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('replays the stored response for the same key and payload', async () => {
    const { service, prisma, handler, input } = setup();
    prisma.idempotencyKey.findUnique.mockResolvedValue({
      requestHash: HASH,
      responseJson: { id: 'order-1' },
    });

    await expect(service.execute(input)).resolves.toEqual({ id: 'order-1' });

    expect(handler).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects the same key with a different payload', async () => {
    const { service, prisma, input } = setup();
    prisma.idempotencyKey.findUnique.mockResolvedValue({
      requestHash: 'a-different-hash',
      responseJson: { id: 'order-1' },
    });

    await expect(service.execute(input)).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
    });
  });

  it('does not store a key when the handler fails', async () => {
    const { service, tx, handler, input } = setup();
    handler.mockRejectedValue(new AppException(400, 'ORDER_INVALID_PAYMENT', 'x'));

    await expect(service.execute(input)).rejects.toBeInstanceOf(AppException);
    expect(tx.idempotencyKey.create).not.toHaveBeenCalled();
  });

  it('replays the winner response when the insert races on a unique key', async () => {
    const { service, prisma, input } = setup();
    prisma.$transaction.mockRejectedValue({ code: 'P2002' });
    prisma.idempotencyKey.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ requestHash: HASH, responseJson: { id: 'order-1' } });

    await expect(service.execute(input)).resolves.toEqual({ id: 'order-1' });
  });

  it('rejects a raced insert whose payload differs', async () => {
    const { service, prisma, input } = setup();
    prisma.$transaction.mockRejectedValue({ code: 'P2002' });
    prisma.idempotencyKey.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        requestHash: 'different',
        responseJson: { id: 'order-1' },
      });

    await expect(service.execute(input)).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
    });
  });
});
