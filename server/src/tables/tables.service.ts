import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface TableResponse {
  id: string;
  legacyId: string | null;
  name: string;
  seats: number;
  zone: string | null;
  sortOrder: number;
}

@Injectable()
export class TablesService {
  constructor(private readonly prisma: PrismaService) {}

  async getTables(restaurantId: string): Promise<TableResponse[]> {
    return this.prisma.table.findMany({
      where: { restaurantId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        legacyId: true,
        name: true,
        seats: true,
        zone: true,
        sortOrder: true,
      },
    });
  }
}
