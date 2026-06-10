import { describe, expect, test } from 'bun:test';
import { projectKeyFrom } from './projectKey';

describe('projectKeyFrom', () => {
  test('prefers slug when present', () => {
    expect(projectKeyFrom({ slug: 'My-Slug', name: 'X', github_url: '' })).toBe('my-slug');
  });

  test('falls back to github owner/repo when possible', () => {
    expect(projectKeyFrom({ name: 'X', github_url: 'https://github.com/Owner/Repo' })).toBe('owner-repo');
  });

  test('ignores invalid github URLs when deriving keys', () => {
    expect(projectKeyFrom({ name: 'Settings Profile', github_url: 'https://github.com/settings/profile' })).toBe('settings-profile');
    expect(projectKeyFrom({ name: 'Http Repo', github_url: 'http://github.com/Owner/Repo' })).toBe('http-repo');
  });

  test('falls back to name', () => {
    expect(projectKeyFrom({ name: 'Hello World', github_url: '' })).toBe('hello-world');
  });
});
