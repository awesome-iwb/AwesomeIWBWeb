import { sql } from "../db/client";

export interface ArticleCommentRow {
  id: string;
  article_id: string;
  parent_id: string | null;
  body: string;
  author_user_id: string | null;
  author_username: string;
  author_role: string;
  created_at: string;
  updated_at: string;
  avatar_url?: string;
  reply_count?: number;
}

export async function listArticleComments(articleId: string, params?: { page?: number; pageSize?: number }) {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const [rows, countRows] = await Promise.all([
    sql()<Array<ArticleCommentRow & { avatar_url: string | null; reply_count: string }>>`
      select c.*, u.avatar_url,
        (select count(*)::text from article_comments r where r.parent_id = c.id) as reply_count
      from article_comments c
      left join users u on u.id = c.author_user_id
      where c.article_id = ${articleId} and c.parent_id is null
      order by c.created_at desc
      limit ${pageSize} offset ${offset}
    `,
    sql()<Array<{ count: string }>>`
      select count(*)::text as count from article_comments
      where article_id = ${articleId} and parent_id is null
    `,
  ]);

  return {
    items: rows.map((r) => ({ ...r, reply_count: Number(r.reply_count ?? 0) })),
    total: Number(countRows[0]?.count ?? 0),
    page,
    pageSize,
  };
}

export async function listArticleCommentReplies(parentId: string, params?: { page?: number; pageSize?: number }) {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 50;
  const offset = (page - 1) * pageSize;

  const [rows, countRows] = await Promise.all([
    sql()<Array<ArticleCommentRow & { avatar_url: string | null }>>`
      select c.*, u.avatar_url
      from article_comments c
      left join users u on u.id = c.author_user_id
      where c.parent_id = ${parentId}
      order by c.created_at asc
      limit ${pageSize} offset ${offset}
    `,
    sql()<Array<{ count: string }>>`
      select count(*)::text as count from article_comments where parent_id = ${parentId}
    `,
  ]);

  return {
    items: rows,
    total: Number(countRows[0]?.count ?? 0),
    page,
    pageSize,
  };
}

export async function createArticleComment(input: {
  article_id: string;
  parent_id?: string | null;
  body: string;
  author_user_id?: string | null;
  author_username: string;
  author_role: string;
}) {
  const [row] = await sql()<Array<ArticleCommentRow>>`
    insert into article_comments (article_id, parent_id, body, author_user_id, author_username, author_role)
    values (${input.article_id}, ${input.parent_id ?? null}, ${input.body}, ${input.author_user_id ?? null}, ${input.author_username}, ${input.author_role})
    returning *
  `;
  return row ?? null;
}

export async function updateArticleComment(id: string, input: { body?: string }) {
  const [row] = await sql()<Array<ArticleCommentRow>>`
    update article_comments set
      body = coalesce(${input.body ?? null}, body),
      updated_at = now()
    where id = ${id}
    returning *
  `;
  return row ?? null;
}

export async function deleteArticleComment(id: string) {
  await sql()`delete from article_comments where id = ${id}`;
}

export async function getArticleComment(id: string) {
  const [row] = await sql()<Array<ArticleCommentRow>>`
    select * from article_comments where id = ${id} limit 1
  `;
  return row ?? null;
}

export async function getArticleIdBySlug(slug: string) {
  const [row] = await sql()<Array<{ id: string }>>`
    select id from articles where slug = ${slug} limit 1
  `;
  return row?.id ?? null;
}
