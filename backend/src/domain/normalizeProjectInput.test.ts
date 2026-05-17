import { describe, expect, test } from 'bun:test';
import { normalizeProjectInput } from './normalizeProjectInput';

describe('normalizeProjectInput', () => {
  test('maps legacy platform developer user_id to stcn_user_id', () => {
    const out: any = normalizeProjectInput({
      name: 'X',
      platform_developers: [{ username: 'u', user_id: 'legacy' }]
    });
    expect(out.platform_developers).toEqual([{ username: 'u', stcn_user_id: 'legacy', hzzc_user_id: '' }]);
  });

  test('accepts legacy media alias fields', () => {
    const out: any = normalizeProjectInput({
      icon_url: '/api/uploads/icon.webp',
      banner_url: '/api/uploads/banner.webp',
      avatar_url: '/api/uploads/avatar.webp'
    });
    expect(out.icon).toBe('/api/uploads/icon.webp');
    expect(out.banner).toBe('/api/uploads/banner.webp');
    expect(out.avatar).toBe('/api/uploads/avatar.webp');
  });
});

