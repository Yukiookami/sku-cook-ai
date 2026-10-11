import { describe, expect, it } from 'vitest';
import { RecipeSchema } from '@sku-cook/shared';
import { createSingleRecipeExport } from './recipe-export';

describe('createSingleRecipeExport', () => {
  it('creates one importable recipe without database metadata or adjusted servings', () => {
    const recipe = RecipeSchema.parse({
      id: 42,
      title: '番茄炒蛋',
      description: null,
      servings: 2,
      prepMinutes: null,
      cookMinutes: 10,
      difficulty: 'easy',
      tags: ['家常菜'],
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
      steps: [{ order: 1, text: '炒熟。' }],
      tips: null,
      source: '家常菜谱',
      createdAt: '2026-10-08T05:00:00.000Z',
      updatedAt: '2026-10-08T05:00:00.000Z',
    });

    expect(createSingleRecipeExport(recipe)).toEqual({
      version: 1,
      recipes: [
        {
          title: '番茄炒蛋',
          servings: 2,
          cookMinutes: 10,
          difficulty: 'easy',
          tags: ['家常菜'],
          ingredients: [{ name: '鸡蛋', amount: '3', unit: '个', scaleWithServings: true }],
          steps: [{ order: 1, text: '炒熟。' }],
          source: '家常菜谱',
        },
      ],
    });
  });
});
