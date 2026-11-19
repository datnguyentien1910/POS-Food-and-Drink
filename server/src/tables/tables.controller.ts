import { Controller, Get } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SESSION_COOKIE } from '../auth/auth.constants.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
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
}
