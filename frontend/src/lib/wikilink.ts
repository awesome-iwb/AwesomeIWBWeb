/** Obsidian-style wikilink: [[slug]] or [[slug|label]] */
export const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

export interface ParsedWikilink {
  slug: string;
  label: string | null;
  raw: string;
  index: number;
}

export function normalizeWikilinkSlug(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/^-+|-+$/g, "");
}

export function parseWikilinks(content: string): ParsedWikilink[] {
  const results: ParsedWikilink[] = [];
  const source = content ?? "";
  let match: RegExpExecArray | null;
  WIKILINK_RE.lastIndex = 0;
  while ((match = WIKILINK_RE.exec(source)) !== null) {
    const slug = normalizeWikilinkSlug(match[1] ?? "");
    if (!slug) continue;
    results.push({
      slug,
      label: match[2] ? String(match[2]).trim() : null,
      raw: match[0],
      index: match.index,
    });
  }
  return results;
}

export function extractWikilinkSlugs(content: string): string[] {
  const slugs = new Set<string>();
  for (const link of parseWikilinks(content)) {
    slugs.add(link.slug);
  }
  return [...slugs];
}

/** Convert wikilinks to markdown links for markdown-it rendering. */
export function replaceWikilinksForMarkdown(content: string): string {
  return (content ?? "").replace(WIKILINK_RE, (_raw, slugPart: string, labelPart?: string) => {
    const slug = normalizeWikilinkSlug(slugPart);
    if (!slug) return _raw;
    const label = String(labelPart ?? slugPart).trim() || slug;
    return `[${label}](/articles/${encodeURIComponent(slug)})`;
  });
}
