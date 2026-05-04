import { describe, expect, test } from 'bun:test';
import { applyProjectPatch } from './projectUpdate';

describe('applyProjectPatch', () => {
  test('applies whitelisted fields and preserves others', () => {
    const before: any = { name: 'A', description: 'old', keywords: ['x'], stars: 10 };
    const after = applyProjectPatch(before, { description: 'new', keywords: 'a, b', stars: 999 } as any);
    expect(after.description).toBe('new');
    expect(after.keywords).toEqual(['a', 'b']);
    expect(after.stars).toBe(10);
  });
});

