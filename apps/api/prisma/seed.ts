import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { readConfig } from '../src/config/env.js';

const config = readConfig(process.env);
const prisma = new PrismaClient({ datasourceUrl: config.DATABASE_URL });

try {
  const user = await prisma.user.upsert({
    where: { id: config.DEFAULT_USER_ID },
    update: {},
    create: { id: config.DEFAULT_USER_ID, name: 'default-user' },
  });
  console.info(`Default user ready: ${user.id}`);
} catch (error) {
  console.error('Failed to seed the database', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
