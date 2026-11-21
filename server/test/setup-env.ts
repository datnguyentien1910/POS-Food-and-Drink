import path from 'node:path';
import 'dotenv/config';

process.env.NODE_ENV = 'test';
process.env.UPLOAD_DIR = path.join(process.cwd(), '.tmp', 'e2e-uploads');
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
process.env.SWAGGER_ENABLED = 'false';
