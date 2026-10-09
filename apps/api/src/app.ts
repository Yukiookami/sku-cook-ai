import Fastify, { type FastifyServerOptions } from 'fastify';
import { registerErrorHandler } from './plugins/error-handler.js';
import { registerPrisma } from './plugins/prisma.js';
import { healthRoutes } from './modules/health/health.route.js';
import { recipeRoutes } from './modules/recipes/recipe.route.js';
import { kitchenRoutes } from './modules/kitchen/kitchen.route.js';
import { historyRoutes } from './modules/history/history.route.js';

declare module 'fastify' {
  interface FastifyInstance {
    defaultUserId: number;
    kitchenPollIntervalSeconds: number;
  }
}

export function buildApp(
  databaseUrl: string,
  options: FastifyServerOptions = { logger: false },
  settings: { defaultUserId?: number; kitchenPollIntervalSeconds?: number } = {},
) {
  const app = Fastify({ bodyLimit: 1_048_576, ...options });
  app.decorate('defaultUserId', settings.defaultUserId ?? 1);
  app.decorate('kitchenPollIntervalSeconds', settings.kitchenPollIntervalSeconds ?? 10);
  registerErrorHandler(app);
  registerPrisma(app, databaseUrl);
  app.register(healthRoutes, { prefix: '/api' });
  app.addHook('onRequest', async (request, reply) => {
    if (request.url.startsWith('/api/') && !request.url.startsWith('/api/health')) {
      reply.header('Cache-Control', 'no-store');
    }
  });
  app.register(recipeRoutes, { prefix: '/api' });
  app.register(kitchenRoutes, { prefix: '/api' });
  app.register(historyRoutes, { prefix: '/api' });
  return app;
}
