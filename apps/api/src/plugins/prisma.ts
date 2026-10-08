import { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export function registerPrisma(app: FastifyInstance, databaseUrl: string) {
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  app.decorate('prisma', prisma);
  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
}
