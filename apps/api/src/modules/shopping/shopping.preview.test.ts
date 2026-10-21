import { describe, expect, it } from 'vitest';
import type { Ingredient, Recipe } from '@prisma/client';
import { shoppingPreview } from './shopping.preview.js';

function preview(ingredients: Partial<Ingredient>[], servings = 2, targetServings = 2) {
  const recipe: Recipe & { ingredients: Ingredient[] } = {
    id: 1,
    userId: 1,
    title: '测试菜',
    description: null,
    servings,
    isLiked: false,
    prepMinutes: null,
    cookMinutes: null,
    difficulty: null,
    tips: null,
    source: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ingredients: ingredients.map((item, index) => ({
      id: index + 1,
      recipeId: 1,
      position: index,
      name: '盐',
      amount: '1',
      unit: '克',
      note: null,
      group: null,
      scaleWithServings: true,
      ...item,
    })),
  };
  return shoppingPreview([recipe], { items: [{ recipeId: 1, targetServings }] });
}
describe('采购保守合并与来源', () => {
  it('精确累加小数和无单位数值，不换单位、不合并备注或近似名称', () => {
    const result = preview([
      { amount: '0.1' },
      { amount: '0.2' },
      { amount: '10', unit: '个' },
      { amount: '0.5', unit: null },
      { amount: '0.5', unit: null },
      { note: '出锅再放' },
      { note: '出锅再放' },
      { name: '食盐' },
    ]);
    expect(result.items.map((item) => item.quantityText)).toEqual([
      '0.3',
      '10',
      '1',
      '1',
      '1',
      '1',
    ]);
    expect(result.items[0]?.sources).toHaveLength(2);
    expect(result.items[3]?.sources[0]?.originalText).toContain('出锅再放');
    expect(preview([{ amount: '0.1' }, { amount: '0.2' }]).items[0]?.itemId).toBe(
      result.items[0]?.itemId,
    );
  });
  it('范围、分数和文字保留，关闭换算不倍增，近似值不参与合并', () => {
    const result = preview(
      [
        { amount: '适量' },
        { amount: '少许' },
        { amount: '2～3' },
        { amount: '1/2' },
        { amount: '10', scaleWithServings: false },
        { amount: '1' },
        { amount: '1' },
      ],
      3,
      2,
    );
    expect(result.items.map((item) => item.quantityText)).toEqual([
      '适量',
      '少许',
      '2～3',
      '1/2',
      '10',
      '约0.67',
      '约0.67',
    ]);
  });
  it('单项来源上限50后拆项，所有原文来源仍被保留', () => {
    const result = preview(Array.from({ length: 51 }, () => ({})));
    expect(result.items.map((item) => item.quantityText)).toEqual(['50', '1']);
    expect(result.items.map((item) => item.sources.length)).toEqual([50, 1]);
    expect(new Set(result.items.map((item) => item.itemId)).size).toBe(2);
  });
});
