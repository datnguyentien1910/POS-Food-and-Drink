import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';
import { AppException } from '../errors/app.exception.js';

export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';
export const IDEMPOTENCY_KEY_MAX_LENGTH = 100;

/**
 * Reads and validates the required `Idempotency-Key` header. Missing or
 * out-of-range keys fail with `400 IDEMPOTENCY_KEY_REQUIRED`.
 */
export const IdempotencyKey = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<Request>();
    const key = request.header(IDEMPOTENCY_KEY_HEADER);
    if (!key || key.length < 1 || key.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
      throw new AppException(
        400,
        'IDEMPOTENCY_KEY_REQUIRED',
        'Thiếu hoặc sai header Idempotency-Key',
      );
    }
    return key;
  },
);
