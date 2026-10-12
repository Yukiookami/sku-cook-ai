import { describe, expect, it } from 'vitest';
import {
  TakeoutCandidateInputSchema,
  TakeoutImportInputSchema,
  TakeoutRandomQuerySchema,
  TakeoutRandomResponseSchema,
} from './takeout.js';

describe('takeout contracts', () => {
  it('trims names and links and only accepts HTTP(S) URLs without embedded credentials', () => {
    expect(
      TakeoutCandidateInputSchema.parse({
        name: '  青椒肉丝  ',
        url: ' https://food.example.com/share/123 ',
      }),
    ).toEqual({ name: '青椒肉丝', url: 'https://food.example.com/share/123' });
    expect(TakeoutCandidateInputSchema.parse({ name: '街边小店' })).toEqual({
      name: '街边小店',
      url: '',
    });
    expect(TakeoutCandidateInputSchema.parse({ name: '街边小店', url: '  ' })).toEqual({
      name: '街边小店',
      url: '',
    });
    for (const url of [
      'javascript:alert(1)',
      'file:///tmp/recipe',
      'https://user:password@food.example.com/share',
      'not-a-url',
    ]) {
      expect(TakeoutCandidateInputSchema.safeParse({ name: '菜', url }).success).toBe(false);
    }
  });

  it('keeps import envelopes strict, bounded and separate from recipe data', () => {
    const candidate = { name: '店铺', url: 'https://food.example.com/shop/1' };
    expect(
      TakeoutImportInputSchema.parse({ version: 1, candidates: [candidate] }).candidates,
    ).toEqual([candidate]);
    expect(
      TakeoutImportInputSchema.safeParse({ version: 2, candidates: [candidate] }).success,
    ).toBe(false);
    expect(
      TakeoutImportInputSchema.safeParse({ version: 1, candidates: [candidate], recipes: [] })
        .success,
    ).toBe(false);
    expect(TakeoutImportInputSchema.safeParse({ version: 1, candidates: [] }).success).toBe(false);
    expect(
      TakeoutImportInputSchema.parse({
        version: 1,
        candidates: [{ name: '没有链接的店' }, { name: '另一家', url: '' }],
      }).candidates,
    ).toEqual([
      { name: '没有链接的店', url: '' },
      { name: '另一家', url: '' },
    ]);
  });

  it('validates exclusion and explicit empty/one-candidate result shapes', () => {
    expect(TakeoutRandomQuerySchema.safeParse({ excludeCandidateId: 0 }).success).toBe(false);
    expect(TakeoutRandomQuerySchema.safeParse({ userId: 1 }).success).toBe(false);
    expect(
      TakeoutRandomResponseSchema.safeParse({ candidate: null, reason: 'EMPTY_LIBRARY' }).success,
    ).toBe(true);
    expect(TakeoutRandomResponseSchema.safeParse({ candidate: null, reason: null }).success).toBe(
      false,
    );
  });
});
