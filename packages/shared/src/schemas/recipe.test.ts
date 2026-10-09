import { describe, expect, it } from 'vitest';
import {
  RecipeImportInputSchema,
  RecipeImportValidationRequestSchema,
  RecipeInputSchema,
  RecipeListQuerySchema,
} from './recipe.js';
import { KitchenReplaceInputSchema } from './kitchen.js';
import { CookingHistoryInputSchema } from './history.js';

const validRecipe = {
  title: '  番茄炒蛋  ',
  ingredients: [{ name: ' 鸡蛋 ', amount: '3' }],
  steps: [{ order: 1, text: ' 炒熟 ' }],
};

describe('RecipeInputSchema', () => {
  it('trims text, applies servings defaults, and enforces the confirmed bounds', () => {
    const result = RecipeInputSchema.parse(validRecipe);
    expect(result.title).toBe('番茄炒蛋');
    expect(result.servings).toBe(1);
    expect(result.tags).toEqual([]);
    expect(result.ingredients[0]?.scaleWithServings).toBe(true);
    expect(result.ingredients[0]?.name).toBe('鸡蛋');
    expect(
      RecipeInputSchema.safeParse({
        ...validRecipe,
        servings: 101,
      }).success,
    ).toBe(false);
    expect(
      RecipeInputSchema.safeParse({
        ...validRecipe,
        prepMinutes: 1441,
      }).success,
    ).toBe(false);
  });

  it('rejects unknown fields, duplicate normalized tags and non-contiguous steps', () => {
    expect(RecipeInputSchema.safeParse({ ...validRecipe, userId: 1 }).success).toBe(false);
    expect(RecipeInputSchema.safeParse({ ...validRecipe, tags: ['汤', ' 汤 '] }).success).toBe(
      false,
    );
    expect(
      RecipeInputSchema.safeParse({
        ...validRecipe,
        steps: [{ order: 2, text: '第二步' }],
      }).success,
    ).toBe(false);
  });

  it('allows zero minute values and preserves amounts as strings', () => {
    const parsed = RecipeInputSchema.parse({
      ...validRecipe,
      prepMinutes: 0,
      ingredients: [{ name: '盐', amount: '适量' }],
    });
    expect(parsed.prepMinutes).toBe(0);
    expect(parsed.ingredients[0]?.amount).toBe('适量');
  });
});

describe('query and kitchen/history contracts', () => {
  it('applies paging defaults and rejects unknown filters', () => {
    expect(RecipeListQuerySchema.parse({}).pageSize).toBe(20);
    expect(RecipeListQuerySchema.safeParse({ unexpected: 'x' }).success).toBe(false);
    expect(RecipeListQuerySchema.safeParse({ page: '0' }).success).toBe(false);
  });

  it('requires unique kitchen recipe ids and target servings from 1 to 100', () => {
    expect(
      KitchenReplaceInputSchema.safeParse({
        items: [
          { recipeId: 1, targetServings: 2 },
          { recipeId: 1, targetServings: 3 },
        ],
        expectedRevision: 0,
      }).success,
    ).toBe(false);
    expect(
      KitchenReplaceInputSchema.safeParse({
        items: [{ recipeId: 1, targetServings: 101 }],
        expectedRevision: 0,
      }).success,
    ).toBe(false);
    expect(CookingHistoryInputSchema.safeParse({ recipeId: 1, targetServings: 1 }).success).toBe(
      true,
    );
  });

  it('lets import validation inspect invalid rows while formal imports stay strict', () => {
    const request = { version: 1, recipes: [{ title: '', unknown: true }] };
    expect(RecipeImportValidationRequestSchema.safeParse(request).success).toBe(true);
    expect(RecipeImportInputSchema.safeParse(request).success).toBe(false);
  });
});
