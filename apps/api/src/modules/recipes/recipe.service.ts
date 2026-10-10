import {
  RecipeInputSchema,
  RecipeResponseSchema,
  RecipeSummarySchema,
  type RecipeInput,
} from '@sku-cook/shared';
import { Prisma } from '@prisma/client';
import { ApiError, isRecipeTitleUniqueViolation, validationIssues } from '../common/errors.js';

const recipeInclude = {
  ingredients: { orderBy: { position: 'asc' as const } },
  steps: { orderBy: { order: 'asc' as const } },
  tags: { orderBy: { position: 'asc' as const } },
};

type RecipeRecord = Prisma.RecipeGetPayload<{ include: typeof recipeInclude }>;

export function recipeDto(record: RecipeRecord) {
  try {
    return RecipeResponseSchema.shape.recipe.parse({
      id: record.id,
      title: record.title,
      description: record.description,
      servings: record.servings,
      prepMinutes: record.prepMinutes,
      cookMinutes: record.cookMinutes,
      difficulty: record.difficulty,
      tags: record.tags.map((tag) => tag.value),
      ingredients: record.ingredients.map(
        ({ name, amount, unit, note, group, scaleWithServings }) => ({
          name,
          amount,
          unit,
          note,
          group,
          scaleWithServings,
        }),
      ),
      steps: record.steps.map(({ order, text }) => ({ order, text })),
      tips: record.tips,
      source: record.source,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    });
  } catch (error) {
    throw new Error('Stored recipe violates the response contract', { cause: error });
  }
}

export function recipeExportDto(record: RecipeRecord) {
  return RecipeInputSchema.parse({
    title: record.title,
    ...(record.description === null ? {} : { description: record.description }),
    servings: record.servings,
    ...(record.prepMinutes === null ? {} : { prepMinutes: record.prepMinutes }),
    ...(record.cookMinutes === null ? {} : { cookMinutes: record.cookMinutes }),
    ...(record.difficulty === null ? {} : { difficulty: record.difficulty }),
    tags: record.tags.map(({ value }) => value),
    ingredients: record.ingredients.map(
      ({ name, amount, unit, note, group, scaleWithServings }) => ({
        name,
        ...(amount === null ? {} : { amount }),
        ...(unit === null ? {} : { unit }),
        ...(note === null ? {} : { note }),
        ...(group === null ? {} : { group }),
        scaleWithServings,
      }),
    ),
    steps: record.steps.map(({ order, text }) => ({ order, text })),
    ...(record.tips === null ? {} : { tips: record.tips }),
    ...(record.source === null ? {} : { source: record.source }),
  });
}

export function summaryDto(record: {
  id: number;
  title: string;
  description: string | null;
  servings: number;
  prepMinutes: number | null;
  cookMinutes: number | null;
  difficulty: string | null;
  tags: { value: string }[];
  updatedAt: Date;
}) {
  try {
    return RecipeSummarySchema.parse({
      id: record.id,
      title: record.title,
      description: record.description,
      servings: record.servings,
      prepMinutes: record.prepMinutes,
      cookMinutes: record.cookMinutes,
      difficulty: record.difficulty,
      tags: record.tags.map((tag) => tag.value),
      updatedAt: record.updatedAt.toISOString(),
    });
  } catch (error) {
    throw new Error('Stored recipe summary violates the response contract', { cause: error });
  }
}

export function randomCandidateIndex(candidateCount: number, random = Math.random): number {
  if (!Number.isSafeInteger(candidateCount) || candidateCount <= 0) {
    throw new RangeError('Candidate count must be a positive safe integer');
  }
  const sample = random();
  if (sample < 0 || sample >= 1) {
    throw new RangeError('Random sample must be in the range [0, 1)');
  }
  return Math.floor(sample * candidateCount);
}

export async function lockDefaultUser(tx: Prisma.TransactionClient, userId: number) {
  await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
}

export async function findTitleConflicts(
  tx: Prisma.TransactionClient,
  userId: number,
  titles: string[],
  excludingId?: number,
) {
  if (!titles.length) return [];
  return tx.recipe.findMany({
    where: {
      userId,
      title: { in: titles },
      ...(excludingId === undefined ? {} : { id: { not: excludingId } }),
    },
    select: { title: true },
  });
}

export async function createRecipe(
  tx: Prisma.TransactionClient,
  userId: number,
  input: RecipeInput,
) {
  return tx.recipe.create({
    data: {
      userId,
      title: input.title,
      description: input.description ?? null,
      servings: input.servings,
      prepMinutes: input.prepMinutes ?? null,
      cookMinutes: input.cookMinutes ?? null,
      difficulty: input.difficulty ?? null,
      tips: input.tips ?? null,
      source: input.source ?? null,
      ingredients: {
        create: input.ingredients.map((ingredient, position) => ({
          position,
          name: ingredient.name,
          amount: ingredient.amount ?? null,
          unit: ingredient.unit ?? null,
          note: ingredient.note ?? null,
          group: ingredient.group ?? null,
          scaleWithServings: ingredient.scaleWithServings,
        })),
      },
      steps: { create: input.steps.map((step) => ({ order: step.order, text: step.text })) },
      tags: { create: input.tags.map((value, position) => ({ value, position })) },
    },
    include: recipeInclude,
  });
}

export function parseRecipeInput(value: unknown): RecipeInput {
  const parsed = RecipeInputSchema.safeParse(value);
  if (!parsed.success) {
    throw new ApiError(400, 'INVALID_INPUT', '请求参数不正确', validationIssues(parsed.error));
  }
  return parsed.data;
}

export function isTitleUniqueViolation(error: unknown): boolean {
  return isRecipeTitleUniqueViolation(error);
}
