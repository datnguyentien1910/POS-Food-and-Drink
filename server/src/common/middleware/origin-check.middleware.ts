import type { NextFunction, Request, Response } from 'express';
import { parseOrigins } from '../../config/env.js';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function originCheckMiddleware(allowedOrigins: string[]) {
  return (request: Request, response: Response, next: NextFunction): void => {
    if (!UNSAFE_METHODS.has(request.method)) {
      next();
      return;
    }

    const origin = request.header('origin');
    if (origin && !allowedOrigins.includes(origin)) {
      response.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Origin không được phép',
        },
      });
      return;
    }

    next();
  };
}

export function originsFromConfig(value: string): string[] {
  return parseOrigins(value);
}
