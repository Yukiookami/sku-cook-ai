import {
  KitchenActiveInputSchema,
  KitchenReplaceInputSchema,
  KitchenRevisionInputSchema,
} from '@sku-cook/shared';
import type { FastifyInstance } from 'fastify';
import { ApiError } from '../common/errors.js';
import { readKitchenState, sessionConflict, withUserLock } from './kitchen.service.js';

export async function kitchenRoutes(app: FastifyInstance) {
  app.get('/kitchen/session', async () =>
    app.prisma.$transaction((tx) => readKitchenState(tx, app), {
      isolationLevel: 'RepeatableRead',
    }),
  );

  app.put('/kitchen/session', async (request) => {
    const input = KitchenReplaceInputSchema.parse(request.body);
    return withUserLock(app, async (tx) => {
      const current = await tx.kitchenSession.findUnique({ where: { userId: app.defaultUserId } });
      const revision = current?.revision ?? 0;
      if (revision !== input.expectedRevision) throw sessionConflict();
      const recipes = await tx.recipe.findMany({
        where: { userId: app.defaultUserId, id: { in: input.items.map((item) => item.recipeId) } },
        select: { id: true },
      });
      const available = new Set(recipes.map(({ id }) => id));
      const missing = input.items.flatMap((item, index) =>
        available.has(item.recipeId)
          ? []
          : [{ path: ['items', index, 'recipeId'], message: '菜谱不存在' }],
      );
      if (missing.length) throw new ApiError(404, 'RECIPE_NOT_FOUND', '部分菜谱不存在', missing);
      const updatedAt = new Date();
      const session = current
        ? await tx.kitchenSession.update({
            where: { id: current.id },
            data: {
              activeRecipeId: input.items[0]?.recipeId ?? null,
              revision: { increment: 1 },
              updatedAt,
              items: {
                deleteMany: {},
                create: input.items.map((item, position) => ({ ...item, position })),
              },
            },
          })
        : await tx.kitchenSession.create({
            data: {
              userId: app.defaultUserId,
              activeRecipeId: input.items[0]?.recipeId ?? null,
              revision: 1,
              updatedAt,
              items: { create: input.items.map((item, position) => ({ ...item, position })) },
            },
          });
      void session;
      return readKitchenState(tx, app);
    });
  });

  app.patch('/kitchen/session/active', async (request) => {
    const input = KitchenActiveInputSchema.parse(request.body);
    return withUserLock(app, async (tx) => {
      const current = await tx.kitchenSession.findUnique({
        where: { userId: app.defaultUserId },
        include: { items: { select: { recipeId: true } } },
      });
      if ((current?.revision ?? 0) !== input.expectedRevision) throw sessionConflict();
      if (!current || !current.items.some(({ recipeId }) => recipeId === input.activeRecipeId)) {
        throw new ApiError(400, 'INVALID_INPUT', '当前菜必须属于厨房菜单', [
          { path: ['activeRecipeId'], message: '请选择厨房菜单中的菜谱' },
        ]);
      }
      if (current.activeRecipeId !== input.activeRecipeId) {
        await tx.kitchenSession.update({
          where: { id: current.id },
          data: {
            activeRecipeId: input.activeRecipeId,
            revision: { increment: 1 },
            updatedAt: new Date(),
          },
        });
      }
      return readKitchenState(tx, app);
    });
  });

  app.delete('/kitchen/session', async (request) => {
    const input = KitchenRevisionInputSchema.parse(request.body);
    return withUserLock(app, async (tx) => {
      const current = await tx.kitchenSession.findUnique({ where: { userId: app.defaultUserId } });
      if ((current?.revision ?? 0) !== input.expectedRevision) throw sessionConflict();
      if (current) {
        const hasItems = await tx.kitchenSessionRecipe.count({
          where: { kitchenSessionId: current.id },
        });
        if (hasItems > 0) {
          await tx.kitchenSessionRecipe.deleteMany({ where: { kitchenSessionId: current.id } });
          await tx.kitchenSession.update({
            where: { id: current.id },
            data: { activeRecipeId: null, revision: { increment: 1 }, updatedAt: new Date() },
          });
        }
      }
      return readKitchenState(tx, app);
    });
  });

  app.post('/kitchen/session/complete', async (request) => {
    const input = KitchenRevisionInputSchema.parse(request.body);
    return withUserLock(app, async (tx) => {
      const current = await tx.kitchenSession.findUnique({
        where: { userId: app.defaultUserId },
        include: {
          items: {
            orderBy: { position: 'asc' },
            include: { recipe: { select: { title: true, userId: true } } },
          },
        },
      });
      if ((current?.revision ?? 0) !== input.expectedRevision) throw sessionConflict();
      if (!current || current.items.length === 0) {
        throw new ApiError(409, 'KITCHEN_SESSION_EMPTY', '厨房菜单为空，无法记录完成');
      }
      if (current.items.some((item) => item.recipe.userId !== app.defaultUserId)) {
        throw new Error('Kitchen session contains a recipe outside its owner scope');
      }
      await tx.cookingHistory.create({
        data: {
          userId: app.defaultUserId,
          source: 'kitchen',
          sourceSessionRevision: current.revision,
          items: {
            create: current.items.map((item, position) => ({
              recipeId: item.recipeId,
              position,
              title: item.recipe.title,
              targetServings: item.targetServings,
            })),
          },
        },
      });
      await tx.kitchenSessionRecipe.deleteMany({ where: { kitchenSessionId: current.id } });
      await tx.kitchenSession.update({
        where: { id: current.id },
        data: { activeRecipeId: null, revision: { increment: 1 }, updatedAt: new Date() },
      });
      return readKitchenState(tx, app);
    });
  });
}
