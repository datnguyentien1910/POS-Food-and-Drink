import 'dotenv/config';
import { createPrismaClient } from '../src/prisma/create-prisma-client.js';
import { seed } from '../src/prisma/seed.js';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to run the seed');
  }

  const prisma = createPrismaClient(connectionString);
  try {
    await seed(prisma, { pinPepper: process.env.PIN_PEPPER ?? '' });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
