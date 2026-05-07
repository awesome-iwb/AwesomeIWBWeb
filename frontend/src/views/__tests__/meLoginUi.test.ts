import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import path from 'path';

const read = () => readFileSync(path.join(import.meta.dir, '..', 'MeView.vue'), 'utf8');

describe('Me login UI', () => {
  test('shows STCN login copy and hides raw id fields', () => {
    const s = read();
    expect(s.includes('智教联盟登录系统')).toBe(true);
    expect(s.includes('演示登录（开发测试）')).toBe(false);
    expect(s.includes('SECTL 用户ID')).toBe(false);
    expect(s.includes('Lincube 用户ID')).toBe(false);
    expect(s.includes('STCN 用户ID（演示）')).toBe(false);
  });
});
