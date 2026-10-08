import { HealthResponseSchema } from '@sku-cook/shared';
import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', () => {
    return HealthResponseSchema.parse({ status: 'ok', service: 'sku-cook-ai-api' });
  });
}
