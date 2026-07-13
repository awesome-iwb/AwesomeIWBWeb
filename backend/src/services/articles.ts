import { sql } from "../db/client";
import { normalizeInternalUploadUrl } from "../domain/urlSafety";
import { syncArticleLinks } from "./articleLinks";
import { createArticleRevision } from "./articleRevisions";

export type ArticleLayoutType = "hero" | "interview" | "app_spotlight";
export type ArticleContentFormat = "markdown" | "html" | "latex" | "plain" | "flarum";
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
const MAX_ARTICLE_TEXT = {
  title: 180,
  subtitle: 500,
  category: 80,
  content: 200000,
  projectName: 160,
  projectSlug: 120,
};
const ARTICLE_LAYOUT_TYPES = new Set<ArticleLayoutType>(["hero", "interview", "app_spotlight"]);
const ARTICLE_CONTENT_FORMATS = new Set<ArticleContentFormat>(["markdown", "html", "latex", "plain", "flarum"]);
const ARTICLE_THEMES = new Set(["dark", "light"]);

function boundedText(value: unknown, max: number, options?: { multiline?: boolean }): string {
  const text = String(value ?? "").replace(/\u0000/g, "");
  const cleaned = options?.multiline
    ? text.replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    : text.replace(/[\u0001-\u001F\u007F]/g, "");
  return cleaned.trim().slice(0, max);
}

function normalizeArticleLayoutType(value: unknown): ArticleLayoutType {
  return ARTICLE_LAYOUT_TYPES.has(value as ArticleLayoutType) ? value as ArticleLayoutType : "hero";
}

function normalizeArticleContentFormat(value: unknown): ArticleContentFormat {
  return ARTICLE_CONTENT_FORMATS.has(value as ArticleContentFormat) ? value as ArticleContentFormat : "markdown";
}

function normalizeArticleTheme(value: unknown): "dark" | "light" {
  return ARTICLE_THEMES.has(String(value)) ? value as "dark" | "light" : "dark";
}

function normalizeArticleStatus(value: unknown, fallback: ArticleStatus = "draft"): ArticleStatus {
  if (value === "published") return "published";
  if (value === "draft") return "draft";
  return fallback;
}

function normalizePublishedAt(value: unknown): string | null {
  if (value == null || value === "") return null;
  const date = new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function normalizeSortIndex(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(-100000, Math.min(100000, Math.trunc(n)));
}

export function normalizeArticleInputForStorage(input: ArticleInput) {
  return {
    title: boundedText(input.title, MAX_ARTICLE_TEXT.title),
    subtitle: boundedText(input.subtitle, MAX_ARTICLE_TEXT.subtitle),
    category: boundedText(input.category, MAX_ARTICLE_TEXT.category),
    layout_type: normalizeArticleLayoutType(input.layout_type),
    content_format: normalizeArticleContentFormat(input.content_format),
    content: boundedText(input.content, MAX_ARTICLE_TEXT.content, { multiline: true }),
    theme: normalizeArticleTheme(input.theme),
    status: normalizeArticleStatus(input.status),
    sort_index: normalizeSortIndex(input.sort_index),
    published_at: normalizePublishedAt(input.published_at),
    projects: normalizeArticleProjects(input.projects),
    cover_image: normalizeArticleCoverImage(input.cover_image),
  };
}

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

export function normalizeArticleCoverImage(value: unknown): string {
  return normalizeInternalUploadUrl(value);
}

function normalizeArticleProjects(value: unknown): ArticleProjectRef[] {
  if (!Array.isArray(value)) return [];
  return value.map((project) => {
    const raw = project && typeof project === "object" ? project as Record<string, unknown> : {};
    const out: ArticleProjectRef = {
      name: boundedText(raw.name, MAX_ARTICLE_TEXT.projectName),
    };
    if (typeof raw.project_id === "string") out.project_id = boundedText(raw.project_id, 80);
    if (typeof raw.slug === "string") out.slug = normalizeArticleSlug(raw.slug).slice(0, MAX_ARTICLE_TEXT.projectSlug);
    const icon = normalizeInternalUploadUrl(raw.icon);
    if (icon) out.icon = icon;
    return out;
  }).filter((project) => project.name || project.project_id || project.slug).slice(0, 20);
}

function mapRow(row: any): ArticleRow {
  const projects = row.projects;
  const safe = normalizeArticleInputForStorage({
    ...row,
    projects: Array.isArray(projects) ? projects : typeof projects === "object" ? projects : [],
  });
  return {
    ...row,
    title: safe.title,
    subtitle: safe.subtitle,
    category: safe.category,
    layout_type: safe.layout_type,
    content_format: safe.content_format,
    content: safe.content,
    cover_image: safe.cover_image,
    theme: safe.theme,
    projects: safe.projects,
    status: safe.status,
    sort_index: safe.sort_index,
    published_at: safe.published_at,
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

  const status = normalizeArticleStatus(input.status);
  const publishedAt = status === "published" ? normalizePublishedAt(input.published_at) ?? new Date().toISOString() : null;
  const safeInput = normalizeArticleInputForStorage(input);

  const [row] = await sql()<Array<any>>`
    insert into articles (
      slug, title, subtitle, category, layout_type, content_format, content,
      cover_image, theme, projects, status, sort_index, published_at, author_user_id
    ) values (
      ${slug},
      ${safeInput.title},
      ${safeInput.subtitle},
      ${safeInput.category},
      ${safeInput.layout_type},
      ${safeInput.content_format},
      ${safeInput.content},
      ${safeInput.cover_image},
      ${safeInput.theme},
      ${sql().json(safeInput.projects)},
      ${status},
      ${safeInput.sort_index},
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

  let status = input.status !== undefined ? normalizeArticleStatus(input.status, existing.status) : normalizeArticleStatus(existing.status);
  let publishedAt = input.published_at !== undefined ? normalizePublishedAt(input.published_at) : existing.published_at;
  if (status === "published" && !publishedAt) {
    publishedAt = new Date().toISOString();
  }
  if (status === "draft") {
    publishedAt = null;
  }
  const coverImage = input.cover_image !== undefined
    ? normalizeArticleCoverImage(input.cover_image)
    : existing.cover_image;
  const projects = input.projects !== undefined ? normalizeArticleProjects(input.projects) : existing.projects;
  const safeInput = normalizeArticleInputForStorage(input);

  const [row] = await sql()<Array<any>>`
    update articles set
      slug = ${slug},
      title = ${input.title !== undefined ? safeInput.title : existing.title},
      subtitle = ${input.subtitle !== undefined ? safeInput.subtitle : existing.subtitle},
      category = ${input.category !== undefined ? safeInput.category : existing.category},
      layout_type = ${input.layout_type !== undefined ? safeInput.layout_type : existing.layout_type},
      content_format = ${input.content_format !== undefined ? safeInput.content_format : existing.content_format},
      content = ${input.content !== undefined ? safeInput.content : existing.content},
      cover_image = ${coverImage},
      theme = ${input.theme !== undefined ? safeInput.theme : existing.theme},
      projects = ${sql().json(projects)},
      status = ${status},
      sort_index = ${input.sort_index !== undefined ? safeInput.sort_index : existing.sort_index},
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
  const urlRe = /(\/api\/uploads\/(?:[a-zA-Z0-9._-]+\/)*[a-zA-Z0-9._-]+)/g;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = urlRe.exec(content)) !== null) {
    fields.push({ url: match[1], fieldPath: `content.asset_${i++}` });
  }
  return fields;
}
