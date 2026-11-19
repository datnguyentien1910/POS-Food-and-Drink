import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { DevicesModule } from '../devices/devices.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { LoginRateLimiter } from './login-rate-limiter.js';
import { LocalAuthGuard } from './passport/local-auth.guard.js';
import { LocalStrategy } from './passport/local.strategy.js';
import { LoginThrottleGuard } from './passport/login-throttle.guard.js';

@Module({
  imports: [PassportModule, DevicesModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    LocalAuthGuard,
    LoginThrottleGuard,
    { provide: LoginRateLimiter, useFactory: () => new LoginRateLimiter() },
  ],
  exports: [AuthService, LoginRateLimiter],
})
export class AuthModule {}
