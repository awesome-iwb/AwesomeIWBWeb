import { describe, expect, test } from 'bun:test';
import { includesNormalized } from './search';

describe('includesNormalized', () => {
  test('matches when query has spaces but target does not', () => {
    expect(includesNormalized('ClassIsland', 'Class Island')).toBe(true);
  });

  test('matches when query has hyphen but target does not', () => {
    expect(includesNormalized('ClassIsland', 'Class-Island')).toBe(true);
  });

  test('empty query matches everything', () => {
    expect(includesNormalized('Anything', '')).toBe(true);
  });
});

