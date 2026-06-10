import { describe, expect, test } from 'bun:test';
import { isInternalUploadUrl, normalizeMediaUrl } from '../useAdminFetch';

describe('normalizeMediaUrl', () => {
  test('keeps site uploads', () => {
    expect(normalizeMediaUrl('/api/uploads/icon.webp')).toBe('/api/uploads/icon.webp');
  });

  test('clears unsafe media URLs by default', () => {
    expect(normalizeMediaUrl('https://example.com/icon.webp')).toBe('');
    expect(normalizeMediaUrl('javascript:alert(1)')).toBe('');
    expect(normalizeMediaUrl('data:image/svg+xml,<svg></svg>')).toBe('');
    expect(normalizeMediaUrl('/api/uploads/../secret.webp')).toBe('');
    expect(normalizeMediaUrl('/api/uploads/%2e%2e/secret.webp')).toBe('');
    expect(normalizeMediaUrl('/api/uploads/icon.webp?x=1')).toBe('');
  });

  test('allows explicit external hosts only when requested', () => {
    expect(normalizeMediaUrl('https://cdn.example.com/icon.webp', { allowedExternalHosts: ['cdn.example.com'] }))
      .toBe('https://cdn.example.com/icon.webp');
  });

  test('validates internal upload URLs', () => {
    expect(isInternalUploadUrl('/api/uploads/a/b.webp')).toBe(true);
    expect(isInternalUploadUrl('/api/uploads/a/b.webp#hash')).toBe(false);
    expect(isInternalUploadUrl('/api/uploads/%2e%2e/b.webp')).toBe(false);
  });
});
