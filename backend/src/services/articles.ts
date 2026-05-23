import { sql } from "../db/client";
import { syncArticleLinks } from "./articleLinks";
import { createArticleRevision } from "./articleRevisions";

export type ArticleLayoutType = "hero" | "interview" | "app_spotlight";
export type ArticleContentFormat = "markdown" | "html" | "latex" | "plain";
export type ArticleStatus = "draft" | "published";

export interface ArticleProjectRef {
  project_id?: string | null;
  slug?: string;
  name: string;
  icon?: string;
}

export interface ArticleRow {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  category: string;
  layout_type: ArticleLayoutType;
  content_format: ArticleContentFormat;
  content: string;
  cover_image: string;
  theme: "dark" | "light";
  projects: ArticleProjectRef[];
  status: ArticleStatus;
  sort_index: number;
  published_at: string | null;
  author_user_id: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeArticleSlug(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export function isValidArticleSlug(slug: string): boolean {
  return slug.length >= 1 && slug.length <= 120 && SLUG_PATTERN.test(slug);
}

function mapRow(row: any): ArticleRow {
  const projects = row.projects;
  return {
    ...row,
    projects: Array.isArray(projects) ? projects : typeof projects === "object" ? projects : [],
  };
}

/** Legacy FeaturedStory shape for GET /api/stories compatibility */
export function toLegacyStoryPayload(article: ArticleRow) {
  return {
    id: article.slug,
    slug: article.slug,
    title: article.title,
    subtitle: article.subtitle,
    category: article.category,
    coverImage: article.cover_image,
    cover_image: article.cover_image,
    date: article.published_at
      ? new Date(article.published_at).toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        }).toUpperCase()
      : "",
    projects: article.projects ?? [],
    theme: article.theme,
    layout_type: article.layout_type,
    content_format: article.content_format,
    content: article.content,
    status: article.status,
    sort_index: article.sort_index,
    published_at: article.published_at,
  };
}

export async function listPublishedArticles(params?: {
  layout?: ArticleLayoutType;
  limit?: number;
}) {
  const limit = Math.min(100, Math.max(1, params?.limit ?? 50));
  const layout = params?.layout;

  const rows = layout
    ? await sql()<Array<any>>`
        select *
        from articles
        where status = 'published' and layout_type = ${layout}
        order by sort_index desc, published_at desc nulls last, updated_at desc
        limit ${limit}
      `
    : await sql()<Array<any>>`
        select *
        from articles
        where status = 'published'
        order by sort_index desc, published_at desc nulls last, updated_at desc
        limit ${limit}
      `;

  return rows.map(mapRow);
}

export async function getPublishedArticleBySlug(slug: string) {
  const rows = await sql()<Array<any>>`
    select *
    from articles
    where slug = ${slug} and status = 'published'
    limit 1
  `;
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function listAdminArticles(params?: { q?: string; status?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, params?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params?.pageSize ?? 50));
  const offset = (page - 1) * pageSize;
  const q = params?.q?.trim() ?? "";
  const status = params?.status?.trim();
  const like = q ? `%${q}%` : null;

  const items =
    status === "draft" || status === "published"
      ? like
        ? await sql()<Array<any>>`
            select * from articles
            where status = ${status}
              and (title ilike ${like} or slug ilike ${like} or category ilike ${like})
            order by sort_index desc, updated_at desc
            limit ${pageSize} offset ${offset}
          `
        : await sql()<Array<any>>`
            select * from articles where status = ${status}
            order by sort_index desc, updated_at desc
            limit ${pageSize} offset ${offset}
          `
      : like
        ? await sql()<Array<any>>`
            select * from articles
            where title ilike ${like} or slug ilike ${like} or category ilike ${like}
            order by sort_index desc, updated_at desc
            limit ${pageSize} offset ${offset}
          `
        : await sql()<Array<any>>`
            select * from articles
            order by sort_index desc, updated_at desc
            limit ${pageSize} offset ${offset}
          `;

  const [{ count }] =
    status === "draft" || status === "published"
      ? like
        ? await sql()<Array<{ count: string }>>`
            select count(*)::text as count from articles
            where status = ${status}
              and (title ilike ${like} or slug ilike ${like} or category ilike ${like})
          `
        : await sql()<Array<{ count: string }>>`
            select count(*)::text as count from articles where status = ${status}
          `
      : like
        ? await sql()<Array<{ count: string }>>`
            select count(*)::text as count from articles
            where title ilike ${like} or slug ilike ${like} or category ilike ${like}
          `
        : await sql()<Array<{ count: string }>>`select count(*)::text as count from articles`;

  return { items: items.map(mapRow), page, pageSize, total: Number(count) };
}

export async function getArticleById(id: string) {
  const rows = await sql()<Array<any>>`
    select * from articles where id = ${id} limit 1
  `;
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function getArticleBySlugAnyStatus(slug: string) {
  const rows = await sql()<Array<any>>`
    select * from articles where slug = ${slug} limit 1
  `;
  return rows[0] ? mapRow(rows[0]) : null;
}

export class ArticleConflictError extends Error {
  serverArticle: ArticleRow;
  constructor(serverArticle: ArticleRow) {
    super("CONFLICT: article version mismatch");
    this.name = "ArticleConflictError";
    this.serverArticle = serverArticle;
  }
}

export type ArticleInput = Partial<
  Pick<
    ArticleRow,
    | "slug"
    | "title"
    | "subtitle"
    | "category"
    | "layout_type"
    | "content_format"
    | "content"
    | "cover_image"
    | "theme"
    | "projects"
    | "status"
    | "sort_index"
    | "published_at"
    | "author_user_id"
  >
> & { expectedVersion?: number };

export async function createArticle(input: ArticleInput) {
  const slug = normalizeArticleSlug(input.slug ?? input.title ?? "article");
  if (!isValidArticleSlug(slug)) throw new Error("invalid slug");

  const status = input.status === "published" ? "published" : "draft";
  const publishedAt = status === "published" ? input.published_at ?? new Date().toISOString() : null;

  const [row] = await sql()<Array<any>>`
    insert into articles (
      slug, title, subtitle, category, layout_type, content_format, content,
      cover_image, theme, projects, status, sort_index, published_at, author_user_id
    ) values (
      ${slug},
      ${input.title ?? ""},
      ${input.subtitle ?? ""},
      ${input.category ?? ""},
      ${input.layout_type ?? "hero"},
      ${input.content_format ?? "markdown"},
      ${input.content ?? ""},
      ${input.cover_image ?? ""},
      ${input.theme ?? "dark"},
      ${sql().json(input.projects ?? [])},
      ${status},
      ${input.sort_index ?? 0},
      ${publishedAt},
      ${input.author_user_id ?? null}
    )
    returning *
  `;
  const article = mapRow(row);
  await syncArticleLinks(article.id, article.content);
  await createArticleRevision(article.id);
  return article;
}

export async function updateArticle(id: string, input: ArticleInput) {
  const existing = await getArticleById(id);
  if (!existing) return null;

  if (input.expectedVersion !== undefined && input.expectedVersion !== existing.version) {
    throw new ArticleConflictError(existing);
  }

  const slug = input.slug !== undefined ? normalizeArticleSlug(input.slug) : existing.slug;
  if (!isValidArticleSlug(slug)) throw new Error("invalid slug");

  let status = input.status ?? existing.status;
  let publishedAt = input.published_at !== undefined ? input.published_at : existing.published_at;
  if (status === "published" && !publishedAt) {
    publishedAt = new Date().toISOString();
  }
  if (status === "draft") {
    publishedAt = null;
  }

  const [row] = await sql()<Array<any>>`
    update articles set
      slug = ${slug},
      title = ${input.title ?? existing.title},
      subtitle = ${input.subtitle ?? existing.subtitle},
      category = ${input.category ?? existing.category},
      layout_type = ${input.layout_type ?? existing.layout_type},
      content_format = ${input.content_format ?? existing.content_format},
      content = ${input.content ?? existing.content},
      cover_image = ${input.cover_image ?? existing.cover_image},
      theme = ${input.theme ?? existing.theme},
      projects = ${sql().json(input.projects ?? existing.projects)},
      status = ${status},
      sort_index = ${input.sort_index ?? existing.sort_index},
      published_at = ${publishedAt},
      author_user_id = ${input.author_user_id !== undefined ? input.author_user_id : existing.author_user_id},
      version = version + 1,
      updated_at = now()
    where id = ${id}
    returning *
  `;
  const article = mapRow(row);
  await syncArticleLinks(article.id, article.content);
  await createArticleRevision(article.id);
  return article;
}

export async function deleteArticle(id: string) {
  const rows = await sql()<Array<any>>`
    delete from articles where id = ${id} returning id
  `;
  return rows.length > 0;
}

export async function publishArticle(id: string, publish: boolean) {
  return updateArticle(id, {
    status: publish ? "published" : "draft",
    published_at: publish ? new Date().toISOString() : null,
  });
}

export function buildArticleMediaFields(article: Pick<ArticleRow, "cover_image" | "content">) {
  const fields: Array<{ url: string; fieldPath: string }> = [];
  if (article.cover_image) fields.push({ url: article.cover_image, fieldPath: "cover_image" });
  const content = article.content ?? "";
  const urlRe = /(\/api\/uploads\/[a-zA-Z0-9._-]+)/g;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = urlRe.exec(content)) !== null) {
    fields.push({ url: match[1], fieldPath: `content.asset_${i++}` });
  }
  return fields;
}
