import { describe, expect, test } from 'bun:test';
import {
  generateOrgSlug,
  normalizeOrganizationAvatarUrl,
  normalizeOrganizationWebsiteUrl,
  validateOrgName,
} from './organizations';

describe('organizations domain', () => {
  describe('generateOrgSlug', () => {
    test('converts Chinese name to pinyin-like slug', () => {
      const slug = generateOrgSlug('测试组织');
      expect(slug).toBeTruthy();
      expect(typeof slug).toBe('string');
    });

    test('lowercases and hyphenates English name', () => {
      expect(generateOrgSlug('My Team')).toBe('my-team');
    });

    test('removes special characters', () => {
      expect(generateOrgSlug('Hello! World@#')).toBe('hello-world');
    });

    test('handles empty string', () => {
      const slug = generateOrgSlug('');
      expect(slug).toBe('');
    });
  });

  describe('validateOrgName', () => {
    test('accepts valid names', () => {
      expect(validateOrgName('测试组织')).toBe(true);
      expect(validateOrgName('My Team')).toBe(true);
    });

    test('rejects empty name', () => {
      expect(validateOrgName('')).toBe(false);
    });

    test('rejects too long name', () => {
      expect(validateOrgName('a'.repeat(101))).toBe(false);
    });
  });

  describe('organization URL normalization', () => {
    test('accepts only safe website URLs', () => {
      expect(normalizeOrganizationWebsiteUrl('https://example.com/team')).toBe('https://example.com/team');
      expect(normalizeOrganizationWebsiteUrl('javascript:alert(1)')).toBe('');
      expect(normalizeOrganizationWebsiteUrl('/relative')).toBe('');
    });

    test('accepts only site upload avatar URLs', () => {
      expect(normalizeOrganizationAvatarUrl('/api/uploads/orgs/a.webp')).toBe('/api/uploads/orgs/a.webp');
      expect(normalizeOrganizationAvatarUrl('https://example.com/a.webp')).toBe('');
      expect(normalizeOrganizationAvatarUrl('/api/uploads/orgs/a.webp?x=1')).toBe('');
    });
  });
});
