import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { SESSION_COOKIE } from '../auth/auth.constants.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { SessionWithData } from '../auth/session.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { AppException } from '../common/errors/app.exception.js';
import { clientIp, userAgent } from '../common/http/request.util.js';
import { DEVICE_COOKIE, DEVICE_COOKIE_MAX_AGE_MS } from './device.constants.js';
import type { DeviceResponse } from './device.types.js';
import { DevicesService } from './devices.service.js';
import { RegisterDeviceDto } from './register-device.dto.js';

type RequestWithSession = Request & { session: SessionWithData };

@ApiTags('devices')
@ApiCookieAuth(SESSION_COOKIE)
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post()
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Đăng ký thiết bị bán hàng' })
  @ApiCreatedResponse({ description: 'Thiết bị mới, kèm cookie restodash.device' })
  async register(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegisterDeviceDto,
    @Req() request: RequestWithSession,
    @Res({ passthrough: true }) response: Response,
  ): Promise<DeviceResponse> {
    if (request.session.authMethod !== 'password') {
      throw new AppException(
        403,
        'FORBIDDEN',
        'Chỉ phiên đăng nhập bằng mật khẩu mới đăng ký được thiết bị',
      );
    }

    const { device, token } = await this.devicesService.register(user, dto.name, {
      ip: clientIp(request),
      userAgent: userAgent(request),
    });

    response.cookie(DEVICE_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: DEVICE_COOKIE_MAX_AGE_MS,
    });

    return device;
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách thiết bị của quán' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<DeviceResponse[]> {
    return this.devicesService.list(user, request.cookies?.[DEVICE_COOKIE]);
  }

  @Delete(':id')
  @Roles('OWNER', 'MANAGER')
  @HttpCode(200)
  @ApiOperation({ summary: 'Thu hồi thiết bị' })
  revoke(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ id: string; revokedAt: Date }> {
    return this.devicesService.revoke(user, id);
  }
}
