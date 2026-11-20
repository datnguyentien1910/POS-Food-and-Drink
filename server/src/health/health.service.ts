import { Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<{
    status: 'ok';
    db: 'up';
    uptime: number;
    version: string;
  }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new AppException(
        503,
        'DB_UNAVAILABLE',
        'Cơ sở dữ liệu không khả dụng',
      );
    }

    return {
      status: 'ok',
      db: 'up',
      uptime: Math.round(process.uptime()),
      version: process.env.npm_package_version ?? '0.0.0',
    };
  }
}
