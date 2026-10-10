import { describe, expect, it } from 'vitest';
import { randomCandidateIndex, recipeExportDto } from './recipe.service.js';

describe('randomCandidateIndex', () => {
  it.each([
    [0, 0],
    [0.5, 2],
    [0.999999, 4],
  ])('selects an index from sample %s for five candidates', (sample, expected) => {
    expect(randomCandidateIndex(5, () => sample)).toBe(expected);
  });

  describe('recipeExportDto', () => {
    it('exports import-compatible fields without database ids or nullable values', () => {
      const exported = recipeExportDto({
        id: 101,
        userId: 1,
        title: '番茄炒蛋',
        description: null,
        servings: 2,
        prepMinutes: null,
        cookMinutes: 10,
        difficulty: null,
        tips: null,
        source: null,
        createdAt: new Date('2026-10-10T00:00:00.000Z'),
        updatedAt: new Date('2026-10-10T00:00:00.000Z'),
        ingredients: [
          {
            id: 1,
            recipeId: 101,
            position: 0,
            name: '鸡蛋',
            amount: '3',
            unit: '个',
            note: null,
            group: null,
            scaleWithServings: true,
          },
        ],
        steps: [{ id: 1, recipeId: 101, order: 1, text: '炒熟。' }],
        tags: [{ id: 1, recipeId: 101, position: 0, value: '家常菜' }],
      });

      expect(exported).toEqual({
        title: '番茄炒蛋',
        servings: 2,
        cookMinutes: 10,
        tags: ['家常菜'],
        ingredients: [{ name: '鸡蛋', amount: '3', unit: '个', scaleWithServings: true }],
        steps: [{ order: 1, text: '炒熟。' }],
      });
    });
  });

  it('rejects an empty candidate list and invalid sampler output', () => {
    expect(() => randomCandidateIndex(0)).toThrow(RangeError);
    expect(() => randomCandidateIndex(2, () => 1)).toThrow(RangeError);
  });
});
