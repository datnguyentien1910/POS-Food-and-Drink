import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { SESSION_COOKIE } from './auth.constants.js';
import { AuthService } from './auth.service.js';
import type { AuthenticatedUser, LoginResponse } from './auth.types.js';
import { LoginDto } from './login.dto.js';
import { LocalAuthGuard } from './passport/local-auth.guard.js';
import { LoginThrottleGuard } from './passport/login-throttle.guard.js';
import type { SessionWithData } from './session.types.js';

type RequestWithSession = Request & { session: SessionWithData };

@ApiTags('auth')
@ApiCookieAuth(SESSION_COOKIE)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(LoginThrottleGuard, LocalAuthGuard)
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Đăng nhập bằng email và mật khẩu' })
  @ApiOkResponse({ description: 'Phiên đăng nhập 30 ngày' })
  login(
    @Body() _dto: LoginDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: RequestWithSession,
  ): Promise<LoginResponse> {
    return this.authService.createPasswordSession(request, user);
  }

  @Get('me')
  @ApiOperation({ summary: 'Thông tin phiên đăng nhập hiện tại' })
  me(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: RequestWithSession,
  ): { user: AuthenticatedUser; authMethod: string; expiresAt: string } {
    const { session } = request;
    return {
      user,
      authMethod: session.authMethod ?? 'password',
      expiresAt: session.absoluteExpiresAt ?? '',
    };
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Đăng xuất' })
  async logout(
    @Req() request: RequestWithSession,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ success: true }> {
    await this.authService.logout(request);
    response.clearCookie(SESSION_COOKIE);
    return { success: true };
  }
}
