import { describe, expect, test } from 'bun:test';
import { clampAnalyticsDays } from './analytics';

describe('analytics', () => {
  test('clampAnalyticsDays bounds and defaults', () => {
    expect(clampAnalyticsDays(7)).toBe(7);
    expect(clampAnalyticsDays(0)).toBe(7);
    expect(clampAnalyticsDays(-3)).toBe(1);
    expect(clampAnalyticsDays(120)).toBe(90);
    expect(clampAnalyticsDays(30.9)).toBe(30);
    expect(clampAnalyticsDays(Number.NaN)).toBe(7);
  });
});
