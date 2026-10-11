import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { readConfig } from '../src/config/env.js';
import { bootstrapUser } from '../src/modules/auth/auth.bootstrap.js';

const config = readConfig(process.env);
const prisma = new PrismaClient({ datasourceUrl: config.DATABASE_URL });

try {
  const id = await bootstrapUser(prisma, process.env.BOOTSTRAP_USER_PASSWORD);
  console.info(`Bootstrap user ready: ${id}`);
} catch {
  console.error('Seed failed; check database migrations and BOOTSTRAP_USER_PASSWORD configuration');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
