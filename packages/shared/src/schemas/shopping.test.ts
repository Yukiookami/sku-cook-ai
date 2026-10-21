import { describe, expect, it } from 'vitest';
import { CookShoppingBatchInputSchema } from './shopping.js';

const payload = {
  batchId: '87a8b3be-7ddc-4f88-b206-38268b6eb271',
  schemaVersion: 1,
  title: '晚餐采购',
  plannedDate: null,
  recipes: [{ recipeId: '1', title: '炒蛋', servings: '3人份' }],
  items: [
    {
      itemId: 'f4df45d8-af4f-40c1-a8db-d074beec346b',
      name: '鸡蛋',
      quantityText: '3',
      unit: '个',
      sources: [{ recipeId: '1', originalText: '鸡蛋2个' }],
    },
  ],
};
describe('采购机器契约', () => {
  it('接受上限字段，拒绝任一字段越界及嵌套未知字段', () => {
    const item = {
      ...payload.items[0],
      name: '菜'.repeat(200),
      quantityText: '1'.repeat(200),
      unit: '克'.repeat(100),
      sources: [{ recipeId: '1', originalText: '原'.repeat(500) }],
    };
    const bounded = { ...payload, title: '题'.repeat(200), items: [item] };
    expect(CookShoppingBatchInputSchema.safeParse(bounded).success).toBe(true);
    for (const invalid of [
      { ...item, name: `${item.name}菜` },
      { ...item, quantityText: `${item.quantityText}1` },
      { ...item, unit: `${item.unit}克` },
      { ...item, itemId: 'invalid' },
      { ...item, sources: [{ recipeId: '1', originalText: '原'.repeat(501) }] },
      { ...item, sources: Array.from({ length: 51 }, () => item.sources[0]) },
      { ...item, url: 'https://example.test' },
    ])
      expect(CookShoppingBatchInputSchema.safeParse({ ...bounded, items: [invalid] }).success).toBe(
        false,
      );
  });
  it('接受明确快照及有效日期，拒绝空批、额外字段、重复编号和外部来源', () => {
    expect(CookShoppingBatchInputSchema.parse(payload)).toEqual(payload);
    for (const input of [
      { ...payload, userId: '1' },
      { ...payload, plannedDate: '2026-02-30' },
      { ...payload, items: [] },
      { ...payload, recipes: [] },
      { ...payload, items: [payload.items[0], payload.items[0]] },
      { ...payload, recipes: [payload.recipes[0], payload.recipes[0]] },
      {
        ...payload,
        items: [{ ...payload.items[0], sources: [{ recipeId: '2', originalText: '盐' }] }],
      },
      { ...payload, items: [{ ...payload.items[0], sources: [] }] },
      { ...payload, title: 'a'.repeat(201) },
      {
        ...payload,
        recipes: Array.from({ length: 51 }, (_, index) => ({
          ...payload.recipes[0],
          recipeId: String(index),
        })),
      },
      { ...payload, items: Array.from({ length: 301 }, () => payload.items[0]) },
    ])
      expect(CookShoppingBatchInputSchema.safeParse(input).success).toBe(false);
  });
});
