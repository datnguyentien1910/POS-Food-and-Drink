import { Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception.js';
import type { Table } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateTableDto } from './dto/create-table.dto.js';

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
      where: { restaurantId, isActive: true },
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

  async createTable(
    restaurantId: string,
    dto: CreateTableDto,
  ): Promise<TableResponse> {
    const name = dto.name.trim();
    const legacyId = dto.legacyId?.trim() || null;
    const zone = dto.zone?.trim() || null;

    const existing = legacyId
      ? await this.prisma.table.findUnique({
          where: { restaurantId_legacyId: { restaurantId, legacyId } },
        })
      : null;

    await this.assertNameAvailable(restaurantId, name, existing?.id);

    if (existing) {
      const updated = await this.prisma.table.update({
        where: { id: existing.id },
        data: {
          name,
          seats: dto.seats,
          zone,
          ...(dto.sortOrder !== undefined
            ? { sortOrder: dto.sortOrder }
            : {}),
          isActive: true,
        },
      });
      return this.toResponse(updated);
    }

    const aggregate = await this.prisma.table.aggregate({
      where: { restaurantId },
      _max: { sortOrder: true },
    });

    const created = await this.prisma.table.create({
      data: {
        restaurantId,
        legacyId,
        name,
        seats: dto.seats,
        zone,
        sortOrder: dto.sortOrder ?? (aggregate._max.sortOrder ?? -1) + 1,
      },
    });
    return this.toResponse(created);
  }

  async deleteTable(restaurantId: string, id: string): Promise<void> {
    const table = await this.prisma.table.findFirst({
      where: { id, restaurantId },
      select: { id: true, isActive: true },
    });
    if (!table) {
      throw new AppException(
        404,
        'TABLE_NOT_FOUND',
        'Không tìm thấy bàn',
      );
    }
    if (!table.isActive) return;

    await this.prisma.table.update({
      where: { id: table.id },
      data: { isActive: false },
    });
  }

  private async assertNameAvailable(
    restaurantId: string,
    name: string,
    exceptId?: string,
  ): Promise<void> {
    const conflict = await this.prisma.table.findFirst({
      where: {
        restaurantId,
        isActive: true,
        name: { equals: name, mode: 'insensitive' },
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { id: true },
    });
    if (conflict) {
      throw new AppException(
        409,
        'TABLE_NAME_TAKEN',
        'Tên bàn đã tồn tại',
      );
    }
  }

  private toResponse(table: Table): TableResponse {
    return {
      id: table.id,
      legacyId: table.legacyId,
      name: table.name,
      seats: table.seats,
      zone: table.zone,
      sortOrder: table.sortOrder,
    };
  }
}
