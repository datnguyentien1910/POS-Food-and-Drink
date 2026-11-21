import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { SESSION_COOKIE } from '../auth/auth.constants.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { clientIp, userAgent } from '../common/http/request.util.js';
import { CreateMenuItemDto } from './dto/create-menu-item.dto.js';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto.js';
import { MenuImageUploadInterceptor } from './menu-upload.js';
import { MenuService } from './menu.service.js';
import type {
  MenuCategoryResponse,
  MenuCategorySummary,
  MenuItemResponse,
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

  @Post('items')
  @HttpCode(201)
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Thêm món' })
  createItem(
    @Body() dto: CreateMenuItemDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<MenuItemResponse> {
    return this.menuService.createItem(user.restaurantId, dto, user, {
      ip: clientIp(request),
      userAgent: userAgent(request),
    });
  }

  @Patch('items/:id')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Sửa món' })
  updateItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMenuItemDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<MenuItemResponse> {
    return this.menuService.updateItem(user.restaurantId, id, dto, user, {
      ip: clientIp(request),
      userAgent: userAgent(request),
    });
  }

  @Post('items/:id/image')
  @HttpCode(200)
  @Roles('OWNER', 'MANAGER')
  @UseInterceptors(MenuImageUploadInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiOperation({ summary: 'Tải ảnh món' })
  uploadImage(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<MenuItemResponse> {
    if (!file) {
      throw new BadRequestException('Thiếu file ảnh');
    }
    return this.menuService.setItemImage(
      user.restaurantId,
      id,
      `/uploads/menu/${file.filename}`,
      user,
      { ip: clientIp(request), userAgent: userAgent(request) },
    );
  }

  @Delete('items/:id')
  @HttpCode(204)
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Xoá món' })
  deleteItem(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<void> {
    return this.menuService.deleteItem(user.restaurantId, id, user, {
      ip: clientIp(request),
      userAgent: userAgent(request),
    });
  }
}
