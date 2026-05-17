import { sql } from "../db/client";

export async function createSubmission(
  payload: any,
  meta?: { submitter_user_id?: string | null }
) {
  const submitterMeta = { submitter_user_id: meta?.submitter_user_id ?? null };
  const [row] = await sql()<Array<any>>`
    insert into project_submissions (status, payload, submitter_meta)
    values ('pending', ${payload}, ${sql().json(submitterMeta as any)})
    returning id, status, payload, submitter_meta, review_note, created_at, updated_at
  `;
  return row;
}

export async function listSubmissions(params: { status?: string; q?: string; page?: number; pageSize?: number }) {
  const db = sql();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const status = params.status?.trim() || "pending";
  const q = params.q?.trim();

  let where;
  if (q) {
    where = sql()`status = ${status} and (payload->>'name' ilike ${"%" + q + "%"} or payload->>'github_url' ilike ${"%" + q + "%"})`;
  } else {
    where = sql()`status = ${status}`;
  }

  const items = await sql()<Array<any>>`
    select id, status, payload, submitter_meta, review_note, created_at, updated_at
    from project_submissions
    where ${where}
    order by created_at desc
    limit ${pageSize} offset ${offset}
  `;

  const [{ count }] = await sql()<Array<{ count: string }>>`
    select count(*)::text as count
    from project_submissions
    where ${where}
  `;

  return { items, page, pageSize, total: Number(count) };
}

export async function getSubmission(id: string) {
  const rows = await sql()<Array<any>>`
    select id, status, payload, submitter_meta, review_note, created_at, updated_at
    from project_submissions
    where id = ${id}
    limit 1
  `;
  return rows[0] ?? null;
}

export async function updateSubmissionStatus(id: string, status: string, reviewNote?: string) {
  const [row] = await sql()<Array<any>>`
    update project_submissions
    set status = ${status}, review_note = ${reviewNote ?? ""}, updated_at = now()
    where id = ${id}
    returning id, status, payload, submitter_meta, review_note, created_at, updated_at
  `;
  return row ?? null;
}

