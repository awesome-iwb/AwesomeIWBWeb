import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import path from 'path';

const read = (p: string) => readFileSync(path.join(process.cwd(), p), 'utf8');

describe('asset paths', () => {
  test('BrandMark uses /assets/brand', () => {
    const s = read('src/components/BrandMark.vue');
    expect(s.includes('src="/assets/brand/')).toBe(true);
    expect(s.includes('src="/images/aiwb-icon')).toBe(false);
  });

  test('Footer partner logos use /assets/partners', () => {
    const s = read('src/components/SiteFooter.vue');
    expect(s.includes('src="/assets/partners/')).toBe(true);
    expect(s.includes('src="/images/hz-logo.png"')).toBe(false);
  });
});

