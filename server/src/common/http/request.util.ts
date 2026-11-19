import type { Request } from 'express';

export function clientIp(request: Request): string {
  return request.ip ?? request.socket?.remoteAddress ?? 'unknown';
}

export function userAgent(request: Request): string | undefined {
  return request.header('user-agent') ?? undefined;
}
