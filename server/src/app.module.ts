import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { PgSessionStore, SESSION_STORE } from './auth/session.store.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { SessionAuthGuard } from './common/guards/session-auth.guard.js';
import { validateEnv } from './config/env.js';
import { HealthModule } from './health/health.module.js';
import { MenuModule } from './menu/menu.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { TablesModule } from './tables/tables.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    PrismaModule,
    AuditModule,
    AuthModule,
    HealthModule,
    MenuModule,
    TablesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: SESSION_STORE, useClass: PgSessionStore },
  ],
})
export class AppModule {}
