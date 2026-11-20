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
import { DeviceGuard } from '../devices/device.guard.js';
import type { DeviceContext } from '../devices/device.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { SESSION_COOKIE } from './auth.constants.js';
import { AuthService } from './auth.service.js';
import type {
  AuthenticatedUser,
  LoginResponse,
  StaffMember,
} from './auth.types.js';
import { LoginDto } from './login.dto.js';
import { LocalAuthGuard } from './passport/local-auth.guard.js';
import { LoginThrottleGuard } from './passport/login-throttle.guard.js';
import { ChangePinDto, PinLoginDto } from './pin.dto.js';
import type { SessionWithData } from './session.types.js';

type RequestWithSession = Request & {
  session: SessionWithData;
  sessionID?: string;
  device?: DeviceContext;
  user?: AuthenticatedUser;
};

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

  @Public()
  @UseGuards(DeviceGuard)
  @Get('staff')
  @ApiOperation({ summary: 'Danh sách nhân viên có PIN trên thiết bị này' })
  listStaff(@Req() request: RequestWithSession): Promise<StaffMember[]> {
    return this.authService.listStaff(request.device!.restaurantId);
  }

  @Public()
  @UseGuards(DeviceGuard)
  @Post('pin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Đăng nhập bằng PIN trên thiết bị đã đăng ký' })
  loginWithPin(
    @Body() dto: PinLoginDto,
    @Req() request: RequestWithSession,
  ): Promise<LoginResponse> {
    return this.authService.loginWithPin(
      request,
      request.device!,
      dto.userId,
      dto.pin,
    );
  }

  @Post('pin/change')
  @HttpCode(200)
  @ApiOperation({ summary: 'Đổi PIN của tài khoản đang đăng nhập' })
  changePin(
    @Body() dto: ChangePinDto,
    @Req() request: RequestWithSession,
  ): Promise<{ success: true }> {
    return this.authService.changePin(request, dto.currentPin, dto.newPin);
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
