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
  created_at: string;
  updated_at: string;
};

export async function listFeedback(input: {
  project_name?: string;
  kind?: FeedbackKind;
  status?: "open" | "closed";
  limit?: number;
}) {
  const limit = Math.min(Math.max(Number(input.limit ?? 50) || 50, 1), 200);
  const where: string[] = [];
  const params: any[] = [];

  if (input.project_name) {
    params.push(input.project_name);
    where.push(`project_name = $${params.length}`);
  }
  if (input.kind) {
    params.push(input.kind);
    where.push(`kind = $${params.length}`);
  }
  if (input.status === "open") where.push(`status <> 'done'`);
  if (input.status === "closed") where.push(`status = 'done'`);

  const clause = where.length ? `where ${where.join(" and ")}` : "";
  const rows = await sql().unsafe(
    `select id, project_name, kind, title, body, labels, status, actor_username, actor_role, created_at, updated_at
     from feedback_entries ${clause}
     order by created_at desc
     limit ${limit}`,
    params
  );
  return rows as FeedbackEntry[];
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
  return row ?? null;
}

export async function updateFeedback(input: { id: string; status?: FeedbackStatus; labels?: string[] }) {
  const fields: string[] = [];
  const params: any[] = [];

  if (input.status) {
    params.push(input.status);
    fields.push(`status = $${params.length}`);
  }
  if (input.labels) {
    params.push(input.labels);
    fields.push(`labels = $${params.length}`);
  }
  params.push(input.id);
  fields.push(`updated_at = now()`);
  const setClause = fields.join(", ");

  const rows = await sql().unsafe(
    `update feedback_entries set ${setClause}
     where id = $${params.length}
     returning id, project_name, kind, title, body, labels, status, actor_username, actor_role, created_at, updated_at`,
    params
  );
  return (rows as FeedbackEntry[])[0] ?? null;
}

