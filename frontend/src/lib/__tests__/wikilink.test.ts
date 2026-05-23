import { describe, expect, test } from 'bun:test';
import { parseWikilinks, replaceWikilinksForMarkdown, extractWikilinkSlugs } from '../wikilink';
import { parseMarkdownHeadings } from '../parseMarkdownHeadings';

describe('wikilink', () => {
  test('parseWikilinks extracts slug and label', () => {
    const links = parseWikilinks('Read [[foo-bar|Foo Bar]] now');
    expect(links).toHaveLength(1);
    expect(links[0].slug).toBe('foo-bar');
    expect(links[0].label).toBe('Foo Bar');
  });

  test('replaceWikilinksForMarkdown converts to markdown link', () => {
    const out = replaceWikilinksForMarkdown('Go to [[my-slug|My Title]]');
    expect(out).toBe('Go to [My Title](/articles/my-slug)');
  });

  test('extractWikilinkSlugs returns unique slugs', () => {
    expect(extractWikilinkSlugs('[[a]] [[b]] [[a]]')).toEqual(['a', 'b']);
  });

  test('replaceWikilinksForMarkdown produces markdown link for renderer', () => {
    const out = replaceWikilinksForMarkdown('Link [[test-slug|Test]] end');
    expect(out).toContain('[Test](/articles/test-slug)');
  });
});

describe('parseMarkdownHeadings', () => {
  test('parses headings outside code fences', () => {
    const headings = parseMarkdownHeadings('# One\n\n```\n# not heading\n```\n\n## Two');
    expect(headings).toHaveLength(2);
    expect(headings[0].text).toBe('One');
    expect(headings[1].text).toBe('Two');
  });
});
