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

  test('keeps only HTTPS GitHub repository URLs', () => {
    expect((normalizeProjectInput({ github_url: 'https://github.com/owner/repo' }) as any).github_url)
      .toBe('https://github.com/owner/repo');
    expect((normalizeProjectInput({ github_url: 'https://github.com/owner/repo/issues/1' }) as any).github_url)
      .toBe('https://github.com/owner/repo');
    expect((normalizeProjectInput({ github_url: 'javascript:alert(1)' }) as any).github_url).toBe('');
    expect((normalizeProjectInput({ github_url: 'https://evil.example/owner/repo' }) as any).github_url).toBe('');
    expect((normalizeProjectInput({ github_url: 'https://github.com/settings/profile' }) as any).github_url).toBe('');
    expect((normalizeProjectInput({ github_parent_url: 'https://github.com/upstream/repo.git' }) as any).github_parent_url)
      .toBe('https://github.com/upstream/repo');
  });

  test('normalizes list fields to arrays', () => {
    const out: any = normalizeProjectInput({
      keywords: 'alpha, beta；gamma、delta',
      recommendation: 'stable, watch',
    });
    expect(out.keywords).toEqual(['alpha', 'beta', 'gamma', 'delta']);
    expect(out.recommendation).toEqual(['stable', 'watch']);
  });

  test('keeps only site upload URLs for project media', () => {
    const out: any = normalizeProjectInput({
      icon: 'https://example.com/icon.webp',
      banner: '/api/uploads/banner.webp',
      avatar_url: 'data:image/svg+xml,<svg></svg>',
    });

    expect(out.icon).toBe('');
    expect(out.banner).toBe('/api/uploads/banner.webp');
    expect(out.avatar).toBe('');
  });

  test('handles non-object payloads defensively', () => {
    expect(() => normalizeProjectInput(null)).not.toThrow();
    expect((normalizeProjectInput(null) as any).github_url).toBeUndefined();
  });
});

