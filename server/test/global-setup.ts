import { execSync } from 'node:child_process';
import 'dotenv/config';

/**
 * Runs once per e2e session: applies migrations and seeds the test database
 * (`TEST_DATABASE_URL`). The seed itself is idempotent, so re-running is safe.
 */
export default function globalSetup(): void {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('TEST_DATABASE_URL is required to run the e2e suite');
  }

  const env = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: databaseUrl,
  };

  execSync('npx prisma migrate deploy', { stdio: 'inherit', env });
  execSync('npx tsx prisma/seed.ts', { stdio: 'inherit', env });
}
