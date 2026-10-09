import { CookingHistorySchema, type CookingHistory } from '@sku-cook/shared';
import type { Prisma } from '@prisma/client';

export const historyInclude = {
  items: {
    orderBy: { position: 'asc' as const },
    include: { recipe: { select: { userId: true } } },
  },
};

export function historyDto(record: {
  id: number;
  userId: number;
  cookedAt: Date;
  source: string;
  items: {
    recipeId: number | null;
    title: string;
    targetServings: number;
    recipe?: { userId: number } | null;
  }[];
}): CookingHistory {
  if (
    record.items.some(
      (item) =>
        (item.recipeId === null && item.recipe != null) ||
        (item.recipeId !== null && item.recipe?.userId === undefined),
    )
  ) {
    throw new Error('Cooking history item has an inconsistent recipe reference');
  }
  if (record.items.some((item) => item.recipe && item.recipe.userId !== record.userId)) {
    throw new Error('Cooking history item references a recipe outside its owner scope');
  }
  try {
    return CookingHistorySchema.parse({
      id: record.id,
      cookedAt: record.cookedAt.toISOString(),
      source: record.source,
      items: record.items.map(({ recipeId, title, targetServings }) => ({
        recipeId,
        title,
        targetServings,
      })),
    });
  } catch (error) {
    throw new Error('Cooking history violates its stored data invariant', { cause: error });
  }
}

export type HistoryRecord = Prisma.CookingHistoryGetPayload<{ include: typeof historyInclude }>;
