import { Controller, Get } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SESSION_COOKIE } from '../auth/auth.constants.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { MenuService } from './menu.service.js';
import type {
  MenuCategoryResponse,
  MenuCategorySummary,
} from './menu.service.js';

@ApiTags('menu')
@ApiCookieAuth(SESSION_COOKIE)
@Controller('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get()
  @ApiOperation({ summary: 'Thực đơn đầy đủ theo nhóm' })
  async getMenu(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ categories: MenuCategoryResponse[] }> {
    return { categories: await this.menuService.getMenu(user.restaurantId) };
  }

  @Get('categories')
  @ApiOperation({ summary: 'Danh sách nhóm món (không kèm món)' })
  getCategories(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MenuCategorySummary[]> {
    return this.menuService.getCategories(user.restaurantId);
  }
}
