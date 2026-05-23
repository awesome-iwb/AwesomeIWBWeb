import { sql } from "../db/client";
import { getArticleById, type ArticleRow } from "./articles";

export interface ArticleRevisionRow {
  id: string;
  article_id: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  version: number;
  edited_by: string | null;
  created_at: string;
}

const MAX_REVISIONS = 30;

function buildMetadata(article: ArticleRow): Record<string, unknown> {
  return {
    slug: article.slug,
    subtitle: article.subtitle,
    category: article.category,
    layout_type: article.layout_type,
    content_format: article.content_format,
    cover_image: article.cover_image,
    theme: article.theme,
    projects: article.projects,
    status: article.status,
    sort_index: article.sort_index,
    published_at: article.published_at,
    author_user_id: article.author_user_id,
  };
}

export async function createArticleRevision(articleId: string, editedBy?: string) {
  const article = await getArticleById(articleId);
  if (!article) return;

  await sql()`
    insert into article_revisions (article_id, title, content, metadata, version, edited_by)
    values (${articleId}, ${article.title}, ${article.content}, ${sql().json(buildMetadata(article))}, ${article.version}, ${editedBy ?? null})
  `;

  const toDelete = await sql()<Array<{ id: string }>>`
    select id
    from article_revisions
    where article_id = ${articleId}
    order by created_at desc
    offset ${MAX_REVISIONS}
  `;
  if (toDelete.length) {
    await sql()`delete from article_revisions where id in ${sql(toDelete.map((r) => r.id))}`;
  }
}

export async function listArticleRevisions(articleId: string, params?: { page?: number; pageSize?: number }) {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const [rows, countRows] = await Promise.all([
    sql()<Array<Pick<ArticleRevisionRow, "id" | "title" | "version" | "edited_by" | "created_at">>>`
      select id, title, version, edited_by, created_at
      from article_revisions
      where article_id = ${articleId}
      order by created_at desc
      limit ${pageSize} offset ${offset}
    `,
    sql()<Array<{ count: string }>>`
      select count(*)::text as count from article_revisions where article_id = ${articleId}
    `,
  ]);

  return {
    items: rows,
    total: Number(countRows[0]?.count ?? 0),
    page,
    pageSize,
  };
}

export async function getArticleRevision(revisionId: string) {
  const [row] = await sql()<Array<ArticleRevisionRow>>`
    select * from article_revisions where id = ${revisionId} limit 1
  `;
  return row ?? null;
}

export async function rollbackArticle(articleId: string, revisionId: string) {
  const revision = await getArticleRevision(revisionId);
  if (!revision || revision.article_id !== articleId) return null;

  const meta = revision.metadata;
  const [row] = await sql()<Array<any>>`
    update articles set
      title = ${revision.title},
      content = ${revision.content},
      slug = ${meta.slug ?? ''},
      subtitle = ${meta.subtitle ?? ''},
      category = ${meta.category ?? ''},
      layout_type = ${meta.layout_type ?? 'hero'},
      content_format = ${meta.content_format ?? 'markdown'},
      cover_image = ${meta.cover_image ?? ''},
      theme = ${meta.theme ?? 'dark'},
      projects = ${sql().json(meta.projects ?? [])},
      status = ${meta.status ?? 'draft'},
      sort_index = ${meta.sort_index ?? 0},
      published_at = ${meta.published_at ?? null},
      author_user_id = ${meta.author_user_id ?? null},
      version = version + 1,
      updated_at = now()
    where id = ${articleId}
    returning *
  `;

  if (row) {
    await createArticleRevision(articleId);
  }
  return row ?? null;
}
