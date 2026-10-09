import { describe, expect, it } from 'vitest';
import { randomCandidateIndex } from './recipe.service.js';

describe('randomCandidateIndex', () => {
  it.each([
    [0, 0],
    [0.5, 2],
    [0.999999, 4],
  ])('selects an index from sample %s for five candidates', (sample, expected) => {
    expect(randomCandidateIndex(5, () => sample)).toBe(expected);
  });

  it('rejects an empty candidate list and invalid sampler output', () => {
    expect(() => randomCandidateIndex(0)).toThrow(RangeError);
    expect(() => randomCandidateIndex(2, () => 1)).toThrow(RangeError);
  });
});
