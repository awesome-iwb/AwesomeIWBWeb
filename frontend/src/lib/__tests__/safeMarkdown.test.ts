import { describe, expect, test } from 'bun:test';
import { renderSafeMarkdown } from '../safeMarkdown';

describe('renderSafeMarkdown', () => {
  test('escapes raw html from user and GitHub markdown', () => {
    const html = renderSafeMarkdown('<img src=x onerror=alert(1)> **ok**');
    expect(html).toContain('&lt;img');
    expect(html).not.toContain('<img');
    expect(html).not.toMatch(/<[^>]+\sonerror=/i);
    expect(html).toContain('<strong>ok</strong>');
  });

  test('strips javascript links', () => {
    const html = renderSafeMarkdown('[bad](javascript:alert(1))');
    expect(html).not.toContain('href="javascript:');
  });

  test('adds safe external link attributes', () => {
    const html = renderSafeMarkdown('[site](https://example.com)');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
});
