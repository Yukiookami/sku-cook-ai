export function randomCandidateIndex(candidateCount: number, random = Math.random): number {
  if (!Number.isSafeInteger(candidateCount) || candidateCount <= 0) {
    throw new RangeError('Candidate count must be a positive safe integer');
  }
  const sample = random();
  if (sample < 0 || sample >= 1) {
    throw new RangeError('Random sample must be in the range [0, 1)');
  }
  return Math.floor(sample * candidateCount);
}
