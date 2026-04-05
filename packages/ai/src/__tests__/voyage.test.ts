import { describe, it, expect } from 'vitest';
import { cosineSimilarity } from '../embeddings/voyage.js';

describe('cosineSimilarity', () => {
  it('returns approximately 1.0 for identical vectors', () => {
    const v = [1, 2, 3, 4, 5];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 10);
  });

  it('returns approximately -1.0 for opposite vectors', () => {
    const a = [1, 2, 3];
    const b = [-1, -2, -3];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 10);
  });

  it('returns approximately 0.0 for orthogonal vectors', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.0, 10);
  });

  it('throws on dimension mismatch', () => {
    const a = [1, 2, 3];
    const b = [1, 2];
    expect(() => cosineSimilarity(a, b)).toThrow('Embedding dimensions mismatch: 3 vs 2');
  });

  it('returns 0 when the first vector is all zeros', () => {
    const a = [0, 0, 0];
    const b = [1, 2, 3];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('returns 0 when the second vector is all zeros', () => {
    const a = [1, 2, 3];
    const b = [0, 0, 0];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('returns 0 when both vectors are all zeros', () => {
    const a = [0, 0, 0];
    const b = [0, 0, 0];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('handles high-dimensional vectors (512 dims like voyage-3-lite)', () => {
    const size = 512;
    const a = Array.from({ length: size }, (_, i) => Math.sin(i));
    const b = Array.from({ length: size }, (_, i) => Math.sin(i));
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 10);
  });

  it('computes correct similarity for known values', () => {
    // cos([1,0], [1,1]) = 1 / (1 * sqrt(2)) = 1/sqrt(2) ≈ 0.7071
    const a = [1, 0];
    const b = [1, 1];
    expect(cosineSimilarity(a, b)).toBeCloseTo(1 / Math.sqrt(2), 10);
  });
});
