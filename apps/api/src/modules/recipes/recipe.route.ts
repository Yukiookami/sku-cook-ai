import {
  RecipeIdParamsSchema,
  RecipeImportInputSchema,
  RecipeImportValidationRequestSchema,
  RecipeListQuerySchema,
  RecipeListResponseSchema,
  RecipeRandomQuerySchema,
  RecipeRandomResponseSchema,
  RecipeTagsResponseSchema,
  RecipeTagsQuerySchema,
  RecipeImportResponseSchema,
  RecipeImportValidationResponseSchema,
  type ApiErrorIssue,
} from '@sku-cook/shared';
import { Prisma } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { ApiError, isRecipeTitleUniqueViolation, validationIssues } from '../common/errors.js';
import {
  createRecipe,
  findTitleConflicts,
  lockDefaultUser,
  parseRecipeInput,
  randomCandidateIndex,
  recipeDto,
  summaryDto,
} from './recipe.service.js';

const importValidationFailed = (issues: ApiErrorIssue[]) =>
  new ApiError(422, 'IMPORT_VALIDATION_FAILED', '校验未通过，未导入任何菜谱', issues);

async function inspectImport(
  app: FastifyInstance,
  payload: unknown,
): Promise<{
  inputs: ReturnType<typeof parseRecipeInput>[];
  issues: ApiErrorIssue[];
}> {
  const outer = RecipeImportValidationRequestSchema.safeParse(payload);
  const issues: ApiErrorIssue[] = [];
  if (!outer.success) {
    issues.push(...validationIssues(outer.error));
  }
  if (typeof payload !== 'object' || payload === null || !('recipes' in payload)) {
    return { inputs: [], issues };
  }
  const rawRecipes = (payload as { recipes?: unknown }).recipes;
  if (!Array.isArray(rawRecipes) || rawRecipes.length < 1 || rawRecipes.length > 100) {
    return { inputs: [], issues };
  }
  const inputs: ReturnType<typeof parseRecipeInput>[] = [];
  const titles = new Map<string, number>();
  rawRecipes.forEach((entry, index) => {
    const parsed = parseRecipeEntry(entry);
    if (!parsed.input) {
      issues.push(
        ...parsed.issues.map((issue) => ({
          path: ['recipes', index, ...issue.path],
          message: issue.message,
        })),
      );
      const candidate =
        typeof entry === 'object' && entry !== null && 'title' in entry
          ? (entry as { title?: unknown }).title
          : undefined;
      if (typeof candidate === 'string' && candidate.trim()) {
        const title = candidate.trim();
        const previous = titles.get(title);
        if (previous !== undefined) {
          issues.push({
            path: ['recipes', index, 'title'],
            message: `与第${previous + 1}道菜同名`,
          });
        } else titles.set(title, index);
      }
      return;
    }
    inputs.push(parsed.input);
    const previous = titles.get(parsed.input.title);
    if (previous !== undefined) {
      issues.push({ path: ['recipes', index, 'title'], message: `与第${previous + 1}道菜同名` });
    } else titles.set(parsed.input.title, index);
  });
  const candidates = [...titles.keys()];
  if (candidates.length) {
    const existing = await app.prisma.recipe.findMany({
      where: { userId: app.defaultUserId, title: { in: candidates } },
      select: { title: true },
    });
    for (const record of existing) {
      const index = titles.get(record.title);
      if (index !== undefined) {
        issues.push({ path: ['recipes', index, 'title'], message: '已有同名菜谱' });
      }
    }
  }
  return { inputs, issues };
}

function parseRecipeEntry(value: unknown): {
  input?: ReturnType<typeof parseRecipeInput>;
  issues: ApiErrorIssue[];
} {
  const result = RecipeImportInputSchema.shape.recipes.element.safeParse(value);
  return result.success
    ? { input: result.data, issues: [] }
    : { issues: validationIssues(result.error) };
}

export async function recipeRoutes(app: FastifyInstance) {
  // Static endpoints are declared before /recipes/:id for clarity; Fastify also gives static paths priority.
  app.get('/recipes/tags', async (request) => {
    RecipeTagsQuerySchema.parse(request.query);
    const entries = await app.prisma.recipeTag.findMany({
      where: { recipe: { userId: app.defaultUserId } },
      select: { value: true },
    });
    const tags = [...new Set(entries.map(({ value }) => value))].sort((left, right) =>
      left < right ? -1 : left > right ? 1 : 0,
    );
    return RecipeTagsResponseSchema.parse({ tags });
  });

  app.get('/recipes/random', async (request) => {
    const query = RecipeRandomQuerySchema.parse(request.query);
    const records = await app.prisma.recipe.findMany({
      where: { userId: app.defaultUserId },
      include: { tags: { orderBy: { position: 'asc' } } },
      orderBy: [{ id: 'asc' }],
    });
    const candidates = records.filter((record) => record.id !== query.excludeRecipeId);
    if (!records.length)
      return RecipeRandomResponseSchema.parse({ recipe: null, reason: 'EMPTY_LIBRARY' });
    if (!candidates.length)
      return RecipeRandomResponseSchema.parse({ recipe: null, reason: 'NO_ALTERNATIVE' });
    const record = candidates[randomCandidateIndex(candidates.length)];
    if (!record) throw new Error('Random candidate invariant failed');
    return RecipeRandomResponseSchema.parse({ recipe: summaryDto(record), reason: null });
  });

  app.get('/recipes', async (request) => {
    const query = RecipeListQuerySchema.parse(request.query);
    const where: Prisma.RecipeWhereInput = { userId: app.defaultUserId };
    if (query.q) {
      where.title = {
        contains: query.q.replace(/[\\%_]/g, '\\$&'),
        mode: 'insensitive',
      };
    }
    if (query.tag) where.tags = { some: { value: query.tag } };
    const results = await app.prisma.recipe.findMany({
      where,
      include: { tags: { orderBy: { position: 'asc' } } },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize + 1,
    });
    return RecipeListResponseSchema.parse({
      items: results.slice(0, query.pageSize).map(summaryDto),
      page: query.page,
      pageSize: query.pageSize,
      hasMore: results.length > query.pageSize,
    });
  });

  app.post('/recipes/import/validate', async (request) => {
    const result = await inspectImport(app, request.body);
    if (result.issues.length) throw importValidationFailed(result.issues);
    return RecipeImportValidationResponseSchema.parse({
      valid: true,
      count: result.inputs.length,
      issues: [],
    });
  });

  app.post('/recipes/import', async (request, reply) => {
    const outer = RecipeImportInputSchema.safeParse(request.body);
    if (!outer.success) {
      const checked = await inspectImport(app, request.body);
      throw importValidationFailed(checked.issues);
    }
    const payload = outer.data;
    const firstIndexByTitle = new Map<string, number>();
    const repeatedInputIssues: ApiErrorIssue[] = [];
    payload.recipes.forEach((recipe, index) => {
      const firstIndex = firstIndexByTitle.get(recipe.title);
      if (firstIndex !== undefined) {
        repeatedInputIssues.push({
          path: ['recipes', index, 'title'],
          message: `与第${firstIndex + 1}道菜同名`,
        });
      } else {
        firstIndexByTitle.set(recipe.title, index);
      }
    });
    if (repeatedInputIssues.length) throw importValidationFailed(repeatedInputIssues);
    try {
      const recipeIds = await app.prisma.$transaction(
        async (tx) => {
          await lockDefaultUser(tx, app.defaultUserId);
          const existing = await tx.recipe.findMany({
            where: {
              userId: app.defaultUserId,
              title: { in: payload.recipes.map((recipe) => recipe.title) },
            },
            select: { title: true },
          });
          const duplicates = new Set(existing.map(({ title }) => title));
          if (duplicates.size) {
            throw importValidationFailed(
              payload.recipes.flatMap((recipe, index) =>
                duplicates.has(recipe.title)
                  ? [{ path: ['recipes', index, 'title'], message: '已有同名菜谱' }]
                  : [],
              ),
            );
          }
          const ids: number[] = [];
          for (const recipe of payload.recipes) {
            const created = await createRecipe(tx, app.defaultUserId, recipe);
            ids.push(created.id);
          }
          return ids;
        },
        { timeout: 15_000 },
      );
      return reply
        .code(201)
        .send(RecipeImportResponseSchema.parse({ importedCount: recipeIds.length, recipeIds }));
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (isRecipeTitleUniqueViolation(error)) {
        const conflicts = await app.prisma.recipe.findMany({
          where: {
            userId: app.defaultUserId,
            title: { in: payload.recipes.map(({ title }) => title) },
          },
          select: { title: true },
        });
        if (conflicts.length) {
          const conflictingTitles = new Set(conflicts.map(({ title }) => title));
          throw importValidationFailed(
            payload.recipes.flatMap((recipe, index) =>
              conflictingTitles.has(recipe.title)
                ? [{ path: ['recipes', index, 'title'], message: '已有同名菜谱' }]
                : [],
            ),
          );
        }
      }
      throw error;
    }
  });

  app.get('/recipes/:id', async (request) => {
    const { id } = RecipeIdParamsSchema.parse(request.params);
    const record = await app.prisma.recipe.findFirst({
      where: { id, userId: app.defaultUserId },
      include: {
        ...{
          ingredients: { orderBy: { position: 'asc' as const } },
          steps: { orderBy: { order: 'asc' as const } },
          tags: { orderBy: { position: 'asc' as const } },
        },
      },
    });
    if (!record) throw new ApiError(404, 'RECIPE_NOT_FOUND', '菜谱不存在');
    return { recipe: recipeDto(record) };
  });

  app.post('/recipes', async (request, reply) => {
    const input = parseRecipeInput(request.body);
    try {
      const recipe = await app.prisma.$transaction(async (tx) => {
        await lockDefaultUser(tx, app.defaultUserId);
        const duplicate = await findTitleConflicts(tx, app.defaultUserId, [input.title]);
        if (duplicate.length)
          throw new ApiError(409, 'RECIPE_TITLE_CONFLICT', '菜名已存在', [
            { path: ['title'], message: '已有同名菜谱' },
          ]);
        return createRecipe(tx, app.defaultUserId, input);
      });
      reply.header('Location', `/api/recipes/${recipe.id}`);
      return reply.code(201).send({ recipe: recipeDto(recipe) });
    } catch (error) {
      if (isRecipeTitleUniqueViolation(error)) {
        throw new ApiError(409, 'RECIPE_TITLE_CONFLICT', '菜名已存在', [
          { path: ['title'], message: '已有同名菜谱' },
        ]);
      }
      throw error;
    }
  });

  app.put('/recipes/:id', async (request) => {
    const { id } = RecipeIdParamsSchema.parse(request.params);
    const input = parseRecipeInput(request.body);
    try {
      const updated = await app.prisma.$transaction(async (tx) => {
        await lockDefaultUser(tx, app.defaultUserId);
        const existing = await tx.recipe.findFirst({
          where: { id, userId: app.defaultUserId },
          select: { id: true },
        });
        if (!existing) throw new ApiError(404, 'RECIPE_NOT_FOUND', '菜谱不存在');
        if ((await findTitleConflicts(tx, app.defaultUserId, [input.title], id)).length) {
          throw new ApiError(409, 'RECIPE_TITLE_CONFLICT', '菜名已存在', [
            { path: ['title'], message: '已有同名菜谱' },
          ]);
        }
        const inKitchen = await tx.kitchenSessionRecipe.findFirst({
          where: { recipeId: id, kitchenSession: { userId: app.defaultUserId } },
          select: { kitchenSessionId: true },
        });
        const record = await tx.recipe.update({
          where: { id },
          data: {
            title: input.title,
            description: input.description ?? null,
            servings: input.servings,
            prepMinutes: input.prepMinutes ?? null,
            cookMinutes: input.cookMinutes ?? null,
            difficulty: input.difficulty ?? null,
            tips: input.tips ?? null,
            source: input.source ?? null,
            ingredients: {
              deleteMany: {},
              create: input.ingredients.map((item, position) => ({
                position,
                name: item.name,
                amount: item.amount ?? null,
                unit: item.unit ?? null,
                note: item.note ?? null,
                group: item.group ?? null,
                scaleWithServings: item.scaleWithServings,
              })),
            },
            steps: {
              deleteMany: {},
              create: input.steps.map(({ order, text }) => ({ order, text })),
            },
            tags: {
              deleteMany: {},
              create: input.tags.map((value, position) => ({ value, position })),
            },
          },
          include: {
            ingredients: { orderBy: { position: 'asc' } },
            steps: { orderBy: { order: 'asc' } },
            tags: { orderBy: { position: 'asc' } },
          },
        });
        if (inKitchen) {
          await tx.kitchenSession.update({
            where: { id: inKitchen.kitchenSessionId },
            data: { revision: { increment: 1 }, updatedAt: new Date() },
          });
        }
        return record;
      });
      return { recipe: recipeDto(updated) };
    } catch (error) {
      if (isRecipeTitleUniqueViolation(error)) {
        throw new ApiError(409, 'RECIPE_TITLE_CONFLICT', '菜名已存在', [
          { path: ['title'], message: '已有同名菜谱' },
        ]);
      }
      throw error;
    }
  });

  app.delete('/recipes/:id', async (request, reply) => {
    const { id } = RecipeIdParamsSchema.parse(request.params);
    await app.prisma.$transaction(async (tx) => {
      await lockDefaultUser(tx, app.defaultUserId);
      const existing = await tx.recipe.findFirst({
        where: { id, userId: app.defaultUserId },
        select: { id: true },
      });
      if (!existing) throw new ApiError(404, 'RECIPE_NOT_FOUND', '菜谱不存在');
      const membership = await tx.kitchenSessionRecipe.findFirst({
        where: { recipeId: id, kitchenSession: { userId: app.defaultUserId } },
        select: { kitchenSessionId: true, kitchenSession: { select: { activeRecipeId: true } } },
      });
      if (membership) {
        const remaining = await tx.kitchenSessionRecipe.findMany({
          where: { kitchenSessionId: membership.kitchenSessionId, recipeId: { not: id } },
          orderBy: { position: 'asc' },
        });
        await tx.kitchenSessionRecipe.deleteMany({
          where: { kitchenSessionId: membership.kitchenSessionId },
        });
        if (remaining.length)
          await tx.kitchenSessionRecipe.createMany({
            data: remaining.map((item, position) => ({
              kitchenSessionId: membership.kitchenSessionId,
              recipeId: item.recipeId,
              position,
              targetServings: item.targetServings,
            })),
          });
        await tx.kitchenSession.update({
          where: { id: membership.kitchenSessionId },
          data: {
            activeRecipeId:
              membership.kitchenSession.activeRecipeId === id
                ? (remaining[0]?.recipeId ?? null)
                : membership.kitchenSession.activeRecipeId,
            revision: { increment: 1 },
            updatedAt: new Date(),
          },
        });
      }
      await tx.recipe.delete({ where: { id } });
    });
    return reply.code(204).send();
  });
}
