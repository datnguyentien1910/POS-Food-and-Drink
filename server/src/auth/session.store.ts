import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import connectPgSimple from 'connect-pg-simple';
import session from 'express-session';
import { Pool } from 'pg';

export const SESSION_STORE = Symbol('SESSION_STORE');

/**
 * PostgreSQL-backed session store (`connect-pg-simple`) sharing the app's
 * database. The `session` table is created by the Prisma migration.
 */
@Injectable()
export class PgSessionStore implements OnApplicationShutdown {
  readonly store: session.Store;
  private readonly pool: Pool;

  constructor(config: ConfigService) {
    this.pool = new Pool({
      connectionString: config.getOrThrow<string>('DATABASE_URL'),
    });
    const PgStore = connectPgSimple(session);
    this.store = new PgStore({
      pool: this.pool,
      tableName: 'session',
      createTableIfMissing: false,
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
