import { sql } from "../db/client";

/** Obsidian-style wikilink: [[slug]] or [[slug|label]] */
const WIKILINK_RE = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

export function parseWikilinks(content: string): string[] {
  const slugs = new Set<string>();
  const source = content ?? "";
  let match: RegExpExecArray | null;
  WIKILINK_RE.lastIndex = 0;
  while ((match = WIKILINK_RE.exec(source)) !== null) {
    const slug = String(match[1] ?? "")
      .trim()
      .toLowerCase()
      .replace(/^-+|-+$/g, "");
    if (slug) slugs.add(slug);
  }
  return [...slugs];
}

export async function syncArticleLinks(articleId: string, content: string) {
  const slugs = parseWikilinks(content);
  await sql()`delete from article_links where from_article_id = ${articleId}`;
  for (const toSlug of slugs) {
    await sql()`
      insert into article_links (from_article_id, to_slug)
      values (${articleId}, ${toSlug})
      on conflict do nothing
    `;
  }
}

export interface ArticleBacklinkSummary {
  id: string;
  slug: string;
  title: string;
  status: string;
  updated_at: string;
}

export async function listArticleBacklinks(slug: string): Promise<ArticleBacklinkSummary[]> {
  const normalized = String(slug ?? "")
    .trim()
    .toLowerCase();
  if (!normalized) return [];

  const rows = await sql()<Array<any>>`
    select a.id, a.slug, a.title, a.status, a.updated_at
    from article_links l
    join articles a on a.id = l.from_article_id
    where l.to_slug = ${normalized}
    order by a.updated_at desc
  `;

  return rows.map((row) => ({
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title ?? ""),
    status: String(row.status ?? "draft"),
    updated_at: String(row.updated_at ?? ""),
  }));
}
