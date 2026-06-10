import { sql } from "../db/client";

export type FeedbackKind = "comment" | "bug";
export type FeedbackStatus = "open" | "doing" | "done";

export type FeedbackEntry = {
  id: string;
  project_name: string;
  kind: FeedbackKind;
  title: string;
  body: string;
  labels: string[];
  status: FeedbackStatus;
  actor_username: string;
  actor_role: string;
  actor_avatar_url: string;
  created_at: string;
  updated_at: string;
};

export async function listFeedback(input: {
  project_name?: string;
  project_names?: string[];
  kind?: FeedbackKind;
  status?: "open" | "closed";
  limit?: number;
  page?: number;
  pageSize?: number;
  ids?: string[];
}) {
  const db = sql();
  const projectNameFilter = input.project_name ? db`and fe.project_name = ${input.project_name}` : db``;
  const projectNamesFilter = input.project_names?.length ? db`and fe.project_name = any(${input.project_names}::text[])` : db``;
  const kindFilter = input.kind ? db`and fe.kind = ${input.kind}` : db``;
  const statusFilter = input.status === "open"
    ? db`and fe.status <> 'done'`
    : input.status === "closed"
      ? db`and fe.status = 'done'`
      : db``;
  const idsFilter = input.ids?.length ? db`and fe.id = any(${input.ids}::uuid[])` : db``;

  if (input.page || input.pageSize) {
    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20));
    const offset = (page - 1) * pageSize;
    const rows = await db<FeedbackEntry[]>`
      select fe.id, fe.project_name, fe.kind, fe.title, fe.body, fe.labels, fe.status,
             fe.actor_username, fe.actor_role, coalesce(u.avatar_url, '') as actor_avatar_url,
             fe.created_at, fe.updated_at
      from feedback_entries fe
      left join users u on u.name = fe.actor_username
      where true ${projectNameFilter} ${projectNamesFilter} ${kindFilter} ${statusFilter} ${idsFilter}
      order by fe.created_at desc
      limit ${pageSize} offset ${offset}
    `;
    const [{ count }] = await db<Array<{ count: string }>>`
      select count(*)::text as count
      from feedback_entries fe
      where true ${projectNameFilter} ${projectNamesFilter} ${kindFilter} ${statusFilter} ${idsFilter}
    `;
    return { items: rows, page, pageSize, total: Number(count) };
  }

  const limit = Math.min(Math.max(Number(input.limit ?? 50) || 50, 1), 200);
  return db<FeedbackEntry[]>`
    select fe.id, fe.project_name, fe.kind, fe.title, fe.body, fe.labels, fe.status,
           fe.actor_username, fe.actor_role, coalesce(u.avatar_url, '') as actor_avatar_url,
           fe.created_at, fe.updated_at
    from feedback_entries fe
    left join users u on u.name = fe.actor_username
    where true ${projectNameFilter} ${projectNamesFilter} ${kindFilter} ${statusFilter} ${idsFilter}
    order by fe.created_at desc
    limit ${limit}
  `;
}

export async function createFeedback(input: {
  project_name: string;
  kind: FeedbackKind;
  title: string;
  body: string;
  labels: string[];
  status: FeedbackStatus;
  actor_username: string;
  actor_role: string;
}) {
  const [row] = await sql()<
    FeedbackEntry[]
  >`insert into feedback_entries (project_name, kind, title, body, labels, status, actor_username, actor_role)
    values (${input.project_name}, ${input.kind}, ${input.title}, ${input.body}, ${input.labels}, ${input.status}, ${input.actor_username}, ${input.actor_role})
    returning id, project_name, kind, title, body, labels, status, actor_username, actor_role, created_at, updated_at`;
  if (row) {
    const avatarRow = await sql()<Array<{ avatar_url: string }>>`select coalesce(avatar_url, '') as avatar_url from users where name = ${input.actor_username} limit 1`;
    (row as any).actor_avatar_url = avatarRow[0]?.avatar_url ?? '';
  }
  return row ?? null;
}

export async function updateFeedback(input: { id: string; status?: FeedbackStatus; labels?: string[] }) {
  const [row] = await sql()<FeedbackEntry[]>`
    update feedback_entries
    set status = coalesce(${input.status ?? null}, status),
        labels = coalesce(${input.labels ?? null}, labels),
        updated_at = now()
    where id = ${input.id}
    returning id, project_name, kind, title, body, labels, status, actor_username, actor_role, created_at, updated_at
  `;
  if (row) {
    const avatarRow = await sql()<Array<{ avatar_url: string }>>`select coalesce(avatar_url, '') as avatar_url from users where name = ${row.actor_username} limit 1`;
    (row as any).actor_avatar_url = avatarRow[0]?.avatar_url ?? '';
  }
  return row ?? null;
}
