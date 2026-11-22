import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SESSION_COOKIE } from '../auth/auth.constants.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CreateTableDto } from './dto/create-table.dto.js';
import { TablesService } from './tables.service.js';
import type { TableResponse } from './tables.service.js';

@ApiTags('tables')
@ApiCookieAuth(SESSION_COOKIE)
@Controller('tables')
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách bàn' })
  getTables(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TableResponse[]> {
    return this.tablesService.getTables(user.restaurantId);
  }

  @Post()
  @HttpCode(201)
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Thêm bàn' })
  createTable(
    @Body() dto: CreateTableDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TableResponse> {
    return this.tablesService.createTable(user.restaurantId, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Xoá bàn' })
  deleteTable(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.tablesService.deleteTable(user.restaurantId, id);
  }
}
