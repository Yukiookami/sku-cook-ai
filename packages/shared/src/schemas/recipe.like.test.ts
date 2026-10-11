import { describe, expect, it } from 'vitest';
import {
  RecipeInputSchema,
  RecipeLikeRequestSchema,
  RecipeLikeResponseSchema,
  RecipeSummarySchema,
  RecipeSchema,
} from './recipe.js';

describe('recipe heart contract', () => {
  it('reads explicit hearts consistently in summaries and full recipes, defaulting legacy responses to false', () => {
    const summary = {
      id: 11,
      title: '番茄炒蛋',
      description: null,
      servings: 2,
      prepMinutes: null,
      cookMinutes: 10,
      difficulty: null,
      tags: [],
      updatedAt: '2026-10-11T00:00:00.000Z',
    };
    expect(RecipeSummarySchema.parse(summary).isLiked).toBe(false);
    expect(RecipeSummarySchema.parse({ ...summary, isLiked: true }).isLiked).toBe(true);
    const recipe = {
      ...summary,
      createdAt: summary.updatedAt,
      tips: null,
      source: null,
      ingredients: [
        {
          name: '鸡蛋',
          amount: null,
          unit: null,
          note: null,
          group: null,
          scaleWithServings: true,
        },
      ],
      steps: [{ order: 1, text: '炒熟。' }],
    };
    expect(RecipeSchema.parse(recipe).isLiked).toBe(false);
    expect(RecipeSchema.parse({ ...recipe, isLiked: true }).isLiked).toBe(true);
    expect(RecipeSchema.safeParse({ ...recipe, isLiked: 'true' }).success).toBe(false);
  });
  it('accepts explicit boolean targets only, without user-controlled ownership', () => {
    expect(RecipeLikeRequestSchema.parse({ isLiked: false })).toEqual({ isLiked: false });
    expect(RecipeLikeRequestSchema.parse({ isLiked: true })).toEqual({ isLiked: true });
    for (const value of [{}, { isLiked: 'true' }, { isLiked: true, userId: 1 }]) {
      expect(RecipeLikeRequestSchema.safeParse(value).success).toBe(false);
    }
  });
  it('requires an id and boolean response and does not mix personal hearts into recipe form/import data', () => {
    expect(RecipeLikeResponseSchema.safeParse({ id: 0, isLiked: true }).success).toBe(false);
    expect(RecipeLikeResponseSchema.safeParse({ id: 11 }).success).toBe(false);
    expect(
      RecipeInputSchema.safeParse({
        title: '番茄炒蛋',
        ingredients: [{ name: '鸡蛋' }],
        steps: [{ order: 1, text: '炒熟。' }],
        isLiked: true,
      }).success,
    ).toBe(false);
  });
});
