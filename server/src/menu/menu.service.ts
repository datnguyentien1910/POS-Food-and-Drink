import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { AppException } from '../common/errors/app.exception.js';
import type { MenuItem } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateMenuItemDto } from './dto/create-menu-item.dto.js';
import type { UpdateMenuItemDto } from './dto/update-menu-item.dto.js';
import { menuUploadDir } from './menu-upload.js';

export interface MenuItemResponse {
  id: string;
  legacyId: string | null;
  name: string;
  description: string | null;
  price: number;
  imageKey: string | null;
  imageUrl: string | null;
  available: boolean;
  popular: boolean;
  sortOrder: number;
}

export interface MenuCategoryResponse {
  id: string;
  name: string;
  sortOrder: number;
  items: MenuItemResponse[];
}

export interface MenuCategorySummary {
  id: string;
  name: string;
  sortOrder: number;
}

export interface MenuRequestMeta {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class MenuService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getMenu(restaurantId: string): Promise<MenuCategoryResponse[]> {
    const categories = await this.prisma.category.findMany({
      where: { restaurantId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        items: {
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
    });

    return categories.map((category) => ({
      id: category.id,
      name: category.name,
      sortOrder: category.sortOrder,
      items: category.items.map((item) => this.toResponse(item)),
    }));
  }

  async getCategories(restaurantId: string): Promise<MenuCategorySummary[]> {
    return this.prisma.category.findMany({
      where: { restaurantId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, sortOrder: true },
    });
  }

  async createItem(
    restaurantId: string,
    dto: CreateMenuItemDto,
    actor: AuthenticatedUser,
    meta: MenuRequestMeta,
  ): Promise<MenuItemResponse> {
    await this.assertCategory(restaurantId, dto.categoryId);

    const item = await this.prisma.menuItem.create({
      data: {
        restaurantId,
        categoryId: dto.categoryId,
        name: dto.name,
        description: dto.description ?? null,
        price: dto.price,
        imageKey: dto.imageKey ?? null,
        available: dto.available ?? true,
        popular: dto.popular ?? false,
        sortOrder: dto.sortOrder ?? 0,
      },
    });

    await this.audit.record({
      restaurantId,
      actorId: actor.id,
      action: 'MENU_ITEM_CREATED',
      entity: 'MenuItem',
      entityId: item.id,
      after: this.toResponse(item),
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return this.toResponse(item);
  }

  async updateItem(
    restaurantId: string,
    id: string,
    dto: UpdateMenuItemDto,
    actor: AuthenticatedUser,
    meta: MenuRequestMeta,
  ): Promise<MenuItemResponse> {
    const existing = await this.findItemOrThrow(restaurantId, id);
    if (dto.categoryId !== undefined) {
      await this.assertCategory(restaurantId, dto.categoryId);
    }

    const item = await this.prisma.menuItem.update({
      where: { id: existing.id },
      data: {
        ...(dto.categoryId !== undefined
          ? { categoryId: dto.categoryId }
          : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.imageKey !== undefined ? { imageKey: dto.imageKey } : {}),
        ...(dto.available !== undefined ? { available: dto.available } : {}),
        ...(dto.popular !== undefined ? { popular: dto.popular } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });

    await this.audit.record({
      restaurantId,
      actorId: actor.id,
      action: 'MENU_ITEM_UPDATED',
      entity: 'MenuItem',
      entityId: item.id,
      before: this.toResponse(existing),
      after: this.toResponse(item),
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return this.toResponse(item);
  }

  async setItemImage(
    restaurantId: string,
    id: string,
    imageUrl: string,
    actor: AuthenticatedUser,
    meta: MenuRequestMeta,
  ): Promise<MenuItemResponse> {
    const existing = await this.findItemOrThrow(restaurantId, id);

    const item = await this.prisma.menuItem.update({
      where: { id: existing.id },
      data: { imageUrl },
    });

    if (existing.imageUrl?.startsWith('/uploads/menu/')) {
      try {
        await unlink(
          path.join(menuUploadDir(), path.basename(existing.imageUrl)),
        );
      } catch {
        // The stored file may already be gone; replacing the image still
        // succeeds.
      }
    }

    await this.audit.record({
      restaurantId,
      actorId: actor.id,
      action: 'MENU_ITEM_UPDATED',
      entity: 'MenuItem',
      entityId: item.id,
      before: this.toResponse(existing),
      after: this.toResponse(item),
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return this.toResponse(item);
  }

  async deleteItem(
    restaurantId: string,
    id: string,
    actor: AuthenticatedUser,
    meta: MenuRequestMeta,
  ): Promise<void> {
    const existing = await this.findItemOrThrow(restaurantId, id);

    await this.prisma.menuItem.delete({ where: { id: existing.id } });

    await this.audit.record({
      restaurantId,
      actorId: actor.id,
      action: 'MENU_ITEM_DELETED',
      entity: 'MenuItem',
      entityId: existing.id,
      before: this.toResponse(existing),
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  private async findItemOrThrow(
    restaurantId: string,
    id: string,
  ): Promise<MenuItem> {
    const item = await this.prisma.menuItem.findFirst({
      where: { id, restaurantId },
    });
    if (!item) {
      throw new AppException(
        404,
        'MENU_ITEM_NOT_FOUND',
        'Không tìm thấy món',
      );
    }
    return item;
  }

  private async assertCategory(
    restaurantId: string,
    categoryId: string,
  ): Promise<void> {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, restaurantId },
      select: { id: true },
    });
    if (!category) {
      throw new AppException(
        404,
        'MENU_CATEGORY_NOT_FOUND',
        'Không tìm thấy nhóm món',
      );
    }
  }

  private toResponse(item: MenuItem): MenuItemResponse {
    return {
      id: item.id,
      legacyId: item.legacyId,
      name: item.name,
      description: item.description,
      price: item.price,
      imageKey: item.imageKey,
      imageUrl: item.imageUrl,
      available: item.available,
      popular: item.popular,
      sortOrder: item.sortOrder,
    };
  }
}
