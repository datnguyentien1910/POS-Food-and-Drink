import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export function requestIdMiddleware(
  request: Request & { id?: string },
  response: Response,
  next: NextFunction,
): void {
  const id = request.header('x-request-id') ?? randomUUID();
  request.id = id;
  response.setHeader('x-request-id', id);
  next();
}
