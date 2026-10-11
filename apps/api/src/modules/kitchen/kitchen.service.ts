import { KitchenStateResponseSchema, type KitchenStateResponse } from '@sku-cook/shared';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { ApiError } from '../common/errors.js';
import { lockUser, recipeDto } from '../recipes/recipe.service.js';

const kitchenInclude = {
  items: {
    orderBy: { position: 'asc' as const },
    include: {
      recipe: {
        include: {
          ingredients: { orderBy: { position: 'asc' as const } },
          steps: { orderBy: { order: 'asc' as const } },
          tags: { orderBy: { position: 'asc' as const } },
        },
      },
    },
  },
};

type DbClient = Prisma.TransactionClient | PrismaClient;

export async function readKitchenState(
  client: DbClient,
  app: FastifyInstance,
  userId: number,
): Promise<KitchenStateResponse> {
  const session = await client.kitchenSession.findUnique({
    where: { userId },
    include: kitchenInclude,
  });
  if (!session) {
    try {
      return KitchenStateResponseSchema.parse({
        session: {
          recipeIds: [],
          items: [],
          activeRecipeId: null,
          revision: 0,
          updatedAt: null,
          recipes: [],
        },
        pollIntervalSeconds: app.kitchenPollIntervalSeconds,
      });
    } catch (error) {
      throw new Error('Kitchen session violates its stored data invariant', { cause: error });
    }
  }
  const items = session.items.map((item) => ({
    recipeId: item.recipeId,
    targetServings: item.targetServings,
  }));
  const recipes = session.items.map((item) => {
    if (item.recipe.userId !== userId) {
      throw new Error('Kitchen session contains a recipe outside its owner scope');
    }
    return recipeDto(item.recipe);
  });
  return KitchenStateResponseSchema.parse({
    session: {
      recipeIds: items.map(({ recipeId }) => recipeId),
      items,
      activeRecipeId: session.activeRecipeId,
      revision: session.revision,
      updatedAt: session.updatedAt?.toISOString() ?? null,
      recipes,
    },
    pollIntervalSeconds: app.kitchenPollIntervalSeconds,
  });
}

export async function withUserLock<T>(
  app: FastifyInstance,
  userId: number,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return app.prisma.$transaction(
    async (tx) => {
      await lockUser(tx, userId);
      return operation(tx);
    },
    { timeout: 15_000 },
  );
}

export function sessionConflict() {
  return new ApiError(409, 'SESSION_CONFLICT', '厨房菜单已变更，请重新读取后确认');
}
