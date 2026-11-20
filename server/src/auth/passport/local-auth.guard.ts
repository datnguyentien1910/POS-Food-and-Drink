import type { ExecutionContext } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { clientIp } from '../../common/http/request.util.js';
import { AppException } from '../../common/errors/app.exception.js';
import { AuthService } from '../auth.service.js';
import { LoginRateLimiter } from '../login-rate-limiter.js';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  constructor(
    private readonly authService: AuthService,
    private readonly limiter: LoginRateLimiter,
  ) {
    super();
  }

  getAuthenticateOptions(): { session: boolean } {
    // Sessions are managed by the app, not by passport.
    return { session: false };
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      return (await super.canActivate(context)) as boolean;
    } catch (error) {
      const request = context.switchToHttp().getRequest<Request>();
      this.limiter.recordFailure(clientIp(request));
      await this.authService.recordLoginFailure(request);

      if (error instanceof AppException) {
        throw error;
      }
      throw new AppException(
        401,
        'INVALID_CREDENTIALS',
        'Email hoặc mật khẩu không đúng',
      );
    }
  }
}
