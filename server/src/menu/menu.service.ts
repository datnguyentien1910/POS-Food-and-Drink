import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

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

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

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
      items: category.items.map((item) => ({
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
      })),
    }));
  }

  async getCategories(restaurantId: string): Promise<MenuCategorySummary[]> {
    return this.prisma.category.findMany({
      where: { restaurantId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, sortOrder: true },
    });
  }
}
