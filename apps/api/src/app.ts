import Fastify, { type FastifyServerOptions } from 'fastify';
import { registerErrorHandler } from './plugins/error-handler.js';
import { registerPrisma } from './plugins/prisma.js';
import { healthRoutes } from './modules/health/health.route.js';

export function buildApp(databaseUrl: string, options: FastifyServerOptions = { logger: false }) {
  const app = Fastify(options);
  registerErrorHandler(app);
  registerPrisma(app, databaseUrl);
  app.register(healthRoutes, { prefix: '/api' });
  return app;
}
