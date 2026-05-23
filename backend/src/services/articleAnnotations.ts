import { sql } from "../db/client";

export interface ArticleAnnotationRow {
  id: string;
  article_id: string;
  anchor_id: string;
  selected_text: string;
  body: string;
  author_user_id: string | null;
  author_username: string;
  author_role: string;
  resolved: boolean;
  created_at: string;
  updated_at: string;
  avatar_url?: string;
}

export async function listArticleAnnotations(articleId: string, params?: { resolved?: boolean }) {
  let query = sql()<Array<ArticleAnnotationRow & { avatar_url: string | null }>>`
    select a.*, u.avatar_url
    from article_annotations a
    left join users u on u.id = a.author_user_id
    where a.article_id = ${articleId}
  `;
  if (params?.resolved !== undefined) {
    query = sql()<Array<ArticleAnnotationRow & { avatar_url: string | null }>>`
      select a.*, u.avatar_url
      from article_annotations a
      left join users u on u.id = a.author_user_id
      where a.article_id = ${articleId} and a.resolved = ${params.resolved}
    `;
  }
  const rows = await query`order by a.created_at desc`;
  return rows;
}

export async function createArticleAnnotation(input: {
  article_id: string;
  anchor_id: string;
  selected_text?: string;
  body: string;
  author_user_id?: string | null;
  author_username: string;
  author_role: string;
}) {
  const [row] = await sql()<Array<ArticleAnnotationRow>>`
    insert into article_annotations (article_id, anchor_id, selected_text, body, author_user_id, author_username, author_role)
    values (${input.article_id}, ${input.anchor_id}, ${input.selected_text ?? ""}, ${input.body}, ${input.author_user_id ?? null}, ${input.author_username}, ${input.author_role})
    returning *
  `;
  return row ?? null;
}

export async function updateArticleAnnotation(id: string, input: { body?: string; resolved?: boolean }) {
  const [row] = await sql()<Array<ArticleAnnotationRow>>`
    update article_annotations set
      body = coalesce(${input.body ?? null}, body),
      resolved = coalesce(${input.resolved ?? null}, resolved),
      updated_at = now()
    where id = ${id}
    returning *
  `;
  return row ?? null;
}

export async function deleteArticleAnnotation(id: string) {
  await sql()`delete from article_annotations where id = ${id}`;
}

export async function getArticleAnnotation(id: string) {
  const [row] = await sql()<Array<ArticleAnnotationRow>>`
    select * from article_annotations where id = ${id} limit 1
  `;
  return row ?? null;
}
