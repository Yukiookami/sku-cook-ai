import Fastify, { type FastifyServerOptions } from 'fastify';
import { registerErrorHandler } from './plugins/error-handler.js';
import { registerPrisma } from './plugins/prisma.js';
import { healthRoutes } from './modules/health/health.route.js';
import { recipeRoutes } from './modules/recipes/recipe.route.js';
import { kitchenRoutes } from './modules/kitchen/kitchen.route.js';
import { registerKitchenEvents } from './modules/kitchen/kitchen.events.js';
import { historyRoutes } from './modules/history/history.route.js';
import { authRoutes } from './modules/auth/auth.route.js';
import { registerAuthentication } from './modules/auth/auth.session.js';
import { takeoutRoutes } from './modules/takeout/takeout.route.js';

declare module 'fastify' {
  interface FastifyInstance {
    kitchenPollIntervalSeconds: number;
  }
}

export function buildApp(
  databaseUrl: string,
  options: FastifyServerOptions = { logger: false },
  settings: {
    secureCookie?: boolean;
    allowedOrigin?: string;
    kitchenPollIntervalSeconds?: number;
  } = {},
) {
  const app = Fastify({ bodyLimit: 1_048_576, ...options });
  app.decorate('kitchenPollIntervalSeconds', settings.kitchenPollIntervalSeconds ?? 10);
  registerErrorHandler(app);
  registerPrisma(app, databaseUrl);
  app.register(healthRoutes, { prefix: '/api' });
  const secureCookie = settings.secureCookie ?? process.env.NODE_ENV === 'production';
  registerAuthentication(app, secureCookie, settings.allowedOrigin);
  registerKitchenEvents(app);
  app.register(authRoutes, { prefix: '/api', secureCookie });
  app.register(recipeRoutes, { prefix: '/api' });
  app.register(kitchenRoutes, { prefix: '/api' });
  app.register(historyRoutes, { prefix: '/api' });
  app.register(takeoutRoutes, { prefix: '/api' });
  return app;
}
