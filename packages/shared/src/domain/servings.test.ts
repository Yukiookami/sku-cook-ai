import { describe, expect, it } from 'vitest';
import { recipeTotalMinutes, scaleIngredientAmount } from './servings.js';

describe('scaleIngredientAmount', () => {
  it('scales exact decimals using the original amount and trims insignificant zeroes', () => {
    expect(scaleIngredientAmount('3', true, 2, 3)).toEqual({
      text: '4.5',
      approximate: false,
      unconverted: false,
      preserved: false,
    });
    expect(scaleIngredientAmount('0.10', true, 2, 3).text).toBe('0.15');
    expect(scaleIngredientAmount('3', true, 2, 2).text).toBe('3');
  });

  it('rounds half-up and only marks actual rounding as approximate', () => {
    expect(scaleIngredientAmount('0.67', true, 2, 1)).toEqual({
      text: '0.34',
      approximate: true,
      unconverted: false,
      preserved: false,
    });
    expect(scaleIngredientAmount('0.01', true, 2, 1)).toEqual({
      text: '0.01',
      approximate: true,
      unconverted: false,
      preserved: false,
    });
  });

  it('preserves unsupported values and describes positive rounded zero', () => {
    for (const amount of ['适量', '2～3', '1/2', '-1', '1e3', '0.5克']) {
      expect(scaleIngredientAmount(amount, true, 2, 3).text).toBe(amount);
    }
    expect(scaleIngredientAmount('0.001', true, 100, 1)).toEqual({
      text: '少于0.01',
      approximate: true,
      unconverted: false,
      preserved: false,
    });
    expect(scaleIngredientAmount('10', false, 2, 3).preserved).toBe(true);
    expect(scaleIngredientAmount('0', true, 2, 3).text).toBe('0');
  });

  it('calculates total minutes only when both values exist', () => {
    expect(recipeTotalMinutes(0, 10)).toBe(10);
    expect(recipeTotalMinutes(5, null)).toBeNull();
  });
});
