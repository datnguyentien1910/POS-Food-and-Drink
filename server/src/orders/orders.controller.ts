import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { SESSION_COOKIE } from '../auth/auth.constants.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { IdempotencyKey } from '../common/decorators/idempotency-key.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { clientIp, userAgent } from '../common/http/request.util.js';
import { Paginated } from '../common/types/api.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { OrdersQueryDto } from './dto/orders-query.dto.js';
import { VoidOrderDto } from './dto/void-order.dto.js';
import type { OrderResponse } from './order-response.js';
import { OrdersService } from './orders.service.js';

@ApiTags('orders')
@ApiCookieAuth(SESSION_COOKIE)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(201)
  @Roles('OWNER', 'MANAGER', 'CASHIER')
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Khoá chống tạo trùng (1..100 ký tự)',
  })
  @ApiOperation({ summary: 'Tạo đơn kèm thanh toán' })
  @ApiCreatedResponse({ description: 'Đơn vừa tạo' })
  create(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: AuthenticatedUser,
    @IdempotencyKey() key: string,
    @Req() request: Request,
  ): Promise<OrderResponse> {
    return this.ordersService.create(dto, user, key, {
      ip: clientIp(request),
      userAgent: userAgent(request),
    });
  }

  @Get()
  @Roles('OWNER', 'MANAGER', 'CASHIER')
  @ApiOperation({ summary: 'Danh sách đơn có lọc và phân trang' })
  @ApiOkResponse({ description: 'Danh sách đơn của quán' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OrdersQueryDto,
  ): Promise<Paginated<OrderResponse>> {
    return this.ordersService.list(user.restaurantId, query);
  }

  @Get(':id')
  @Roles('OWNER', 'MANAGER', 'CASHIER')
  @ApiOperation({ summary: 'Chi tiết một đơn' })
  detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OrderResponse> {
    return this.ordersService.detail(user.restaurantId, id);
  }

  @Post(':id/void')
  @Roles('OWNER', 'MANAGER')
  @HttpCode(200)
  @ApiOperation({ summary: 'Huỷ đơn (chỉ chủ/quản lý)' })
  void(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoidOrderDto,
    @Req() request: Request,
  ): Promise<OrderResponse> {
    return this.ordersService.voidOrder(user, id, dto.reason, {
      ip: clientIp(request),
      userAgent: userAgent(request),
    });
  }
}
