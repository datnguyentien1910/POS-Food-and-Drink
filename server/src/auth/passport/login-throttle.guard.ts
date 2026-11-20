import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { clientIp } from '../../common/http/request.util.js';
import { LoginRateLimiter } from '../login-rate-limiter.js';

@Injectable()
export class LoginThrottleGuard implements CanActivate {
  constructor(private readonly limiter: LoginRateLimiter) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    this.limiter.assertAllowed(clientIp(request));
    return true;
  }
}
