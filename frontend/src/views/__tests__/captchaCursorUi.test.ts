import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import path from 'path';

describe('Project detail reCAPTCHA cursor demo', () => {
  test('uses avatar-based cursor badge and looping animation', () => {
    const s = readFileSync(path.join(import.meta.dir, '..', 'ProjectDetailView.vue'), 'utf8');
    expect(s.includes('runCursorLoop')).toBe(true);
    expect(s.includes('developerAvatarUrl')).toBe(true);
    expect(s.includes('cursorAccent')).toBe(true);
    expect(s.includes('computeCursorFrames')).toBe(true);
    expect(s.includes('getBoundingClientRect')).toBe(true);
    expect(s.includes('data-captcha-checkbox')).toBe(true);
  });
});
