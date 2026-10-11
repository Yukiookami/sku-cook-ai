import {
  CookingHistoryIdParamsSchema,
  CookingHistoryInputSchema,
  CookingHistoryListQuerySchema,
  CookingHistoryListResponseSchema,
} from '@sku-cook/shared';
import type { FastifyInstance } from 'fastify';
import { authenticatedUser } from '../auth/auth.session.js';
import { ApiError } from '../common/errors.js';
import { withUserLock } from '../kitchen/kitchen.service.js';
import { historyDto, historyInclude } from './history.service.js';

export async function historyRoutes(app: FastifyInstance) {
  app.get('/cooking-history', async (request) => {
    const userId = authenticatedUser(request).id;
    const query = CookingHistoryListQuerySchema.parse(request.query);
    const records = await app.prisma.$transaction(
      async (tx) =>
        tx.cookingHistory.findMany({
          where: { userId },
          include: historyInclude,
          orderBy: [{ cookedAt: 'desc' }, { id: 'desc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize + 1,
        }),
      { isolationLevel: 'RepeatableRead' },
    );
    return CookingHistoryListResponseSchema.parse({
      items: records.slice(0, query.pageSize).map(historyDto),
      page: query.page,
      pageSize: query.pageSize,
      hasMore: records.length > query.pageSize,
    });
  });

  app.post('/cooking-history', async (request, reply) => {
    const userId = authenticatedUser(request).id;
    const input = CookingHistoryInputSchema.parse(request.body);
    const history = await withUserLock(app, userId, async (tx) => {
      const recipe = await tx.recipe.findFirst({
        where: { id: input.recipeId, userId },
        select: { id: true, title: true },
      });
      if (!recipe) throw new ApiError(404, 'RECIPE_NOT_FOUND', '菜谱不存在');
      const created = await tx.cookingHistory.create({
        data: {
          userId,
          source: 'manual',
          items: {
            create: [
              {
                recipeId: recipe.id,
                position: 0,
                title: recipe.title,
                targetServings: input.targetServings,
              },
            ],
          },
        },
        include: historyInclude,
      });
      return historyDto(created);
    });
    return reply.code(201).send({ history });
  });

  app.delete('/cooking-history/:id', async (request, reply) => {
    const userId = authenticatedUser(request).id;
    const { id } = CookingHistoryIdParamsSchema.parse(request.params);
    await withUserLock(app, userId, async (tx) => {
      const record = await tx.cookingHistory.findFirst({
        where: { id, userId },
        select: { id: true },
      });
      if (!record) throw new ApiError(404, 'COOKING_HISTORY_NOT_FOUND', '做饭记录不存在');
      await tx.cookingHistory.delete({ where: { id } });
    });
    return reply.code(204).send();
  });
}
