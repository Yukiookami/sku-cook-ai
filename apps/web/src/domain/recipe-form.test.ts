import { describe, expect, it } from 'vitest';
import { RecipeSchema } from '@sku-cook/shared';
import { draftFromRecipe, parseAmountUnit, validateRecipeDraft } from './recipe-form';

describe('recipe form mapping', () => {
  it('preserves ambiguous original amount and unit boundaries when editing', () => {
    const recipe = RecipeSchema.parse({
      id: 1,
      title: '家常菜',
      description: null,
      servings: 2,
      prepMinutes: null,
      cookMinutes: 0,
      difficulty: null,
      tags: [],
      ingredients: [
        {
          name: '油',
          amount: '少许',
          unit: '自定义单位',
          note: null,
          group: null,
          scaleWithServings: false,
        },
      ],
      steps: [{ order: 1, text: '炒熟。' }],
      tips: null,
      source: null,
      createdAt: '2026-10-08T05:00:00.000Z',
      updatedAt: '2026-10-08T05:00:00.000Z',
    });
    const parsed = validateRecipeDraft(draftFromRecipe(recipe));
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toMatchObject({
        servings: 2,
        cookMinutes: 0,
        ingredients: [{ amount: '少许', unit: '自定义单位', scaleWithServings: false }],
      });
      expect(parsed.data.prepMinutes).toBeUndefined();
      expect(parsed.data).not.toHaveProperty('prepMinutes');
      expect(parsed.data).not.toHaveProperty('description');
    }
  });

  it.each([
    ['3枚', '3', '枚'],
    ['0.5千克', '0.5', '千克'],
    ['2～3个', '2～3', '个'],
    ['1/2杯', '1/2', '杯'],
    ['适量', '适量', ''],
    ['2～3', '2～3', ''],
    ['', '', ''],
  ])('maps %s without losing quantity text', (input, amount, unit) => {
    expect(parseAmountUnit(input)).toEqual({ amount, unit });
  });
});
