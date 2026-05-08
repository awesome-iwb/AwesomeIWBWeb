import { sql } from "../db/client";

export type ModerationStatus = "pending" | "approved" | "rejected";

export type CommentModerationEntry = {
  id: string;
  project_name: string;
  body: string;
  actor_username: string;
  actor_role: string;
  status: ModerationStatus;
  review_note: string;
  feedback_entry_id: string | null;
  created_at: string;
  updated_at: string;
};

export type BugModerationEntry = {
  id: string;
  project_name: string;
  title: string;
  body: string;
  labels: string[];
  actor_username: string;
  actor_role: string;
  status: ModerationStatus;
  review_note: string;
  feedback_entry_id: string | null;
  created_at: string;
  updated_at: string;
};

export async function createCommentModeration(input: {
  project_name: string;
  body: string;
  actor_username: string;
  actor_role: string;
}) {
  const [row] = await sql()<CommentModerationEntry[]>`
    insert into comment_moderation (project_name, body, actor_username, actor_role, status)
    values (${input.project_name}, ${input.body}, ${input.actor_username}, ${input.actor_role}, 'pending')
    returning id, project_name, body, actor_username, actor_role, status, review_note, feedback_entry_id, created_at, updated_at
  `;
  return row ?? null;
}

export async function createBugModeration(input: {
  project_name: string;
  title: string;
  body: string;
  labels: string[];
  actor_username: string;
  actor_role: string;
}) {
  const [row] = await sql()<BugModerationEntry[]>`
    insert into bug_moderation (project_name, title, body, labels, actor_username, actor_role, status)
    values (${input.project_name}, ${input.title}, ${input.body}, ${input.labels}, ${input.actor_username}, ${input.actor_role}, 'pending')
    returning id, project_name, title, body, labels, actor_username, actor_role, status, review_note, feedback_entry_id, created_at, updated_at
  `;
  return row ?? null;
}

export async function listCommentModeration(params: {
  status?: ModerationStatus;
  actor_username?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const queryParams: any[] = [];

  if (params.status) {
    queryParams.push(params.status);
    conditions.push(`status = $${queryParams.length}`);
  }
  if (params.actor_username) {
    queryParams.push(params.actor_username);
    conditions.push(`actor_username = $${queryParams.length}`);
  }

  const whereClause = conditions.length ? `where ${conditions.join(" and ")}` : "";

  const countQuery = `select count(*)::text as count from comment_moderation ${whereClause}`;
  const itemsQuery = `
    select id, project_name, body, actor_username, actor_role, status, review_note, feedback_entry_id, created_at, updated_at
    from comment_moderation ${whereClause}
    order by created_at desc
    limit ${pageSize} offset ${offset}
  `;

  const items = await sql().unsafe(itemsQuery, queryParams) as CommentModerationEntry[];
  const [{ count }] = await sql().unsafe(countQuery, queryParams) as Array<{ count: string }>;

  return { items, page, pageSize, total: Number(count) };
}

export async function listBugModeration(params: {
  status?: ModerationStatus;
  actor_username?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const queryParams: any[] = [];

  if (params.status) {
    queryParams.push(params.status);
    conditions.push(`status = $${queryParams.length}`);
  }
  if (params.actor_username) {
    queryParams.push(params.actor_username);
    conditions.push(`actor_username = $${queryParams.length}`);
  }

  const whereClause = conditions.length ? `where ${conditions.join(" and ")}` : "";

  const countQuery = `select count(*)::text as count from bug_moderation ${whereClause}`;
  const itemsQuery = `
    select id, project_name, title, body, labels, actor_username, actor_role, status, review_note, feedback_entry_id, created_at, updated_at
    from bug_moderation ${whereClause}
    order by created_at desc
    limit ${pageSize} offset ${offset}
  `;

  const items = await sql().unsafe(itemsQuery, queryParams) as BugModerationEntry[];
  const [{ count }] = await sql().unsafe(countQuery, queryParams) as Array<{ count: string }>;

  return { items, page, pageSize, total: Number(count) };
}

export async function getCommentModeration(id: string) {
  const rows = await sql()<CommentModerationEntry[]>`
    select id, project_name, body, actor_username, actor_role, status, review_note, feedback_entry_id, created_at, updated_at
    from comment_moderation where id = ${id} limit 1
  `;
  return rows[0] ?? null;
}

export async function getBugModeration(id: string) {
  const rows = await sql()<BugModerationEntry[]>`
    select id, project_name, title, body, labels, actor_username, actor_role, status, review_note, feedback_entry_id, created_at, updated_at
    from bug_moderation where id = ${id} limit 1
  `;
  return rows[0] ?? null;
}

export async function updateCommentModerationStatus(
  id: string,
  status: ModerationStatus,
  reviewNote?: string
) {
  const [row] = await sql()<CommentModerationEntry[]>`
    update comment_moderation
    set status = ${status}, review_note = ${reviewNote ?? ""}, updated_at = now()
    where id = ${id}
    returning id, project_name, body, actor_username, actor_role, status, review_note, feedback_entry_id, created_at, updated_at
  `;
  return row ?? null;
}

export async function updateBugModerationStatus(
  id: string,
  status: ModerationStatus,
  reviewNote?: string
) {
  const [row] = await sql()<BugModerationEntry[]>`
    update bug_moderation
    set status = ${status}, review_note = ${reviewNote ?? ""}, updated_at = now()
    where id = ${id}
    returning id, project_name, title, body, labels, actor_username, actor_role, status, review_note, feedback_entry_id, created_at, updated_at
  `;
  return row ?? null;
}

export async function setCommentFeedbackEntryId(moderationId: string, feedbackEntryId: string) {
  await sql()`
    update comment_moderation
    set feedback_entry_id = ${feedbackEntryId}, updated_at = now()
    where id = ${moderationId}
  `;
}

export async function setBugFeedbackEntryId(moderationId: string, feedbackEntryId: string) {
  await sql()`
    update bug_moderation
    set feedback_entry_id = ${feedbackEntryId}, updated_at = now()
    where id = ${moderationId}
  `;
}
