import type { AxiosAdapter } from 'axios';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CookingHistoryListResponseSchema,
  CookingHistoryResponseSchema,
  KitchenStateResponseSchema,
  RecipeInputSchema,
  RecipeListResponseSchema,
  RecipeResponseSchema,
  RecipeSummarySchema,
  RecipeTagsResponseSchema,
} from '@sku-cook/shared';
import { client } from './client';
import { apiErrorIssues, apiErrorMessage } from './errors';
import {
  completeKitchenMenu,
  clearKitchenMenu,
  getKitchenState,
  replaceKitchenMenu,
  setKitchenActiveRecipe,
} from './kitchen';
import { deleteCookingHistory, getCookingHistory, recordCookingHistory } from './cooking-history';
import {
  createRecipe,
  deleteRecipe,
  getRandomRecipe,
  getRecipe,
  getRecipeTags,
  getRecipes,
  importRecipes,
  updateRecipe,
  validateRecipeImport,
} from './recipes';

const originalAdapter = client.defaults.adapter;
const calls: { method: string; url: string; params: unknown; data: unknown }[] = [];
let responseBody: unknown;
let responseStatus = 200;

const adapter: AxiosAdapter = async (config) => {
  calls.push({
    method: config.method ?? '',
    url: config.url ?? '',
    params: config.params,
    data: config.data,
  });
  return {
    data: responseBody,
    status: responseStatus,
    statusText: responseStatus === 204 ? 'No Content' : 'OK',
    headers: {},
    config,
    request: {},
  };
};

const recipeInput = RecipeInputSchema.parse({
  title: '番茄炒蛋',
  servings: 2,
  ingredients: [{ name: '鸡蛋', amount: '3', unit: '个' }],
  steps: [{ order: 1, text: '炒熟。' }],
});

const recipeResponse = RecipeResponseSchema.parse({
  recipe: {
    ...recipeInput,
    id: 101,
    description: null,
    prepMinutes: null,
    cookMinutes: null,
    difficulty: null,
    tips: null,
    source: null,
    createdAt: '2026-10-08T05:00:00.000Z',
    updatedAt: '2026-10-08T05:00:00.000Z',
    ingredients: [
      {
        name: '鸡蛋',
        amount: '3',
        unit: '个',
        note: null,
        group: null,
        scaleWithServings: true,
      },
    ],
  },
});

const recipeSummary = RecipeSummarySchema.parse({
  id: 101,
  title: '番茄炒蛋',
  description: null,
  servings: 2,
  prepMinutes: null,
  cookMinutes: null,
  difficulty: null,
  tags: [],
  updatedAt: '2026-10-08T05:00:00.000Z',
});

const recipeList = RecipeListResponseSchema.parse({
  items: [recipeSummary],
  page: 1,
  pageSize: 20,
  hasMore: false,
});

const kitchenState = KitchenStateResponseSchema.parse({
  session: {
    recipeIds: [101],
    items: [{ recipeId: 101, targetServings: 3 }],
    activeRecipeId: 101,
    revision: 1,
    updatedAt: '2026-10-08T05:00:00.000Z',
    recipes: [recipeResponse.recipe],
  },
  pollIntervalSeconds: 10,
});

const history = CookingHistoryResponseSchema.parse({
  history: {
    id: 501,
    cookedAt: '2026-10-08T05:00:00.000Z',
    source: 'manual',
    items: [{ recipeId: 101, title: '番茄炒蛋', targetServings: 3 }],
  },
});

beforeEach(() => {
  calls.length = 0;
  responseBody = undefined;
  responseStatus = 200;
  client.defaults.adapter = adapter;
});

afterEach(() => {
  client.defaults.adapter = originalAdapter;
});

function requestBody(index: number): unknown {
  const value = calls[index]?.data;
  return typeof value === 'string' ? JSON.parse(value) : value;
}

describe('Web API clients use the shared Contract and Axx routes', () => {
  it('calls recipe endpoints with documented methods, params, bodies and response envelopes', async () => {
    responseBody = recipeList;
    await getRecipes({ page: 1, pageSize: 20, q: '番茄', tag: '家常菜' });
    responseBody = RecipeTagsResponseSchema.parse({ tags: ['家常菜'] });
    await getRecipeTags();
    responseBody = recipeResponse;
    await getRecipe(101);
    await createRecipe(recipeInput);
    await updateRecipe(101, recipeInput);
    responseStatus = 204;
    await deleteRecipe(101);

    responseStatus = 200;
    responseBody = { recipe: recipeSummary, reason: null };
    await getRandomRecipe(101);
    responseBody = { valid: true, count: 1, issues: [] };
    await validateRecipeImport({ version: 1, recipes: [recipeInput] });
    responseBody = { importedCount: 1, recipeIds: [101] };
    await importRecipes({ version: 1, recipes: [recipeInput] });

    expect(calls.map(({ method, url }) => [method, url])).toEqual([
      ['get', '/recipes'],
      ['get', '/recipes/tags'],
      ['get', '/recipes/101'],
      ['post', '/recipes'],
      ['put', '/recipes/101'],
      ['delete', '/recipes/101'],
      ['get', '/recipes/random'],
      ['post', '/recipes/import/validate'],
      ['post', '/recipes/import'],
    ]);
    expect(calls[0]?.params).toEqual({ page: 1, pageSize: 20, q: '番茄', tag: '家常菜' });
    expect(requestBody(3)).toEqual(recipeInput);
    expect(requestBody(4)).toEqual(recipeInput);
    expect(requestBody(7)).toEqual({ version: 1, recipes: [recipeInput] });
    expect(requestBody(8)).toEqual({ version: 1, recipes: [recipeInput] });
    expect(calls[5]?.data).toBeUndefined();
  });

  it('uses revision-bearing kitchen methods and sends DELETE bodies for A13', async () => {
    responseBody = kitchenState;
    await getKitchenState();
    await replaceKitchenMenu({
      items: [{ recipeId: 101, targetServings: 3 }],
      expectedRevision: 1,
    });
    await setKitchenActiveRecipe({ activeRecipeId: 101, expectedRevision: 1 });
    await clearKitchenMenu({ expectedRevision: 1 });
    await completeKitchenMenu({ expectedRevision: 1 });

    expect(calls.map(({ method, url }) => [method, url])).toEqual([
      ['get', '/kitchen/session'],
      ['put', '/kitchen/session'],
      ['patch', '/kitchen/session/active'],
      ['delete', '/kitchen/session'],
      ['post', '/kitchen/session/complete'],
    ]);
    expect(requestBody(1)).toEqual({
      items: [{ recipeId: 101, targetServings: 3 }],
      expectedRevision: 1,
    });
    expect(requestBody(2)).toEqual({ activeRecipeId: 101, expectedRevision: 1 });
    expect(requestBody(3)).toEqual({ expectedRevision: 1 });
    expect(requestBody(4)).toEqual({ expectedRevision: 1 });
  });

  it('uses history envelopes and consumes A18 HTTP 204 without parsing a body', async () => {
    responseBody = CookingHistoryListResponseSchema.parse({
      items: [history.history],
      page: 1,
      pageSize: 20,
      hasMore: false,
    });
    await getCookingHistory(1);
    responseBody = history;
    responseStatus = 201;
    await recordCookingHistory({ recipeId: 101, targetServings: 3 });
    responseStatus = 204;
    responseBody = undefined;
    await deleteCookingHistory(501);

    expect(calls.map(({ method, url }) => [method, url])).toEqual([
      ['get', '/cooking-history'],
      ['post', '/cooking-history'],
      ['delete', '/cooking-history/501'],
    ]);
    expect(calls[0]?.params).toEqual({ page: 1, pageSize: 20 });
    expect(requestBody(1)).toEqual({ recipeId: 101, targetServings: 3 });
    expect(calls[2]?.data).toBeUndefined();
  });

  it('rejects malformed success payloads and reads the shared error envelope', async () => {
    responseBody = {};
    await expect(getRecipe(101)).rejects.toThrow();

    const error = Object.assign(new Error('validation failed'), {
      isAxiosError: true,
      response: {
        status: 422,
        data: {
          error: {
            code: 'IMPORT_VALIDATION_FAILED',
            message: '校验未通过，未导入任何菜谱',
            issues: [{ path: ['recipes', 0, 'title'], message: '已有同名菜谱' }],
          },
        },
      },
    });
    expect(apiErrorMessage(error, '请求失败')).toBe('校验未通过，请根据提示修正后重试。');
    expect(apiErrorIssues(error)).toEqual([
      { path: ['recipes', 0, 'title'], message: '已有同名菜谱' },
    ]);
  });
});
