import { sql } from "../db/client";

export async function createSubmission(payload: any) {
  const [row] = await sql()<Array<any>>`
    insert into project_submissions (status, payload, submitter_meta)
    values ('pending', ${payload}, ${{} as any})
    returning id, status, payload, review_note, created_at, updated_at
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

  const whereParts = [db`status = ${status}`];
  if (q) whereParts.push(db`(payload->>'name' ilike ${"%" + q + "%"} or payload->>'github_url' ilike ${"%" + q + "%"})`);
  const where = db.join(whereParts, db` and `);

  const items = await db<Array<any>>`
    select id, status, payload, review_note, created_at, updated_at
    from project_submissions
    where ${where}
    order by created_at desc
    limit ${pageSize} offset ${offset}
  `;

  const [{ count }] = await db<Array<{ count: string }>>`
    select count(*)::text as count
    from project_submissions
    where ${where}
  `;

  return { items, page, pageSize, total: Number(count) };
}

export async function getSubmission(id: string) {
  const rows = await sql()<Array<any>>`
    select id, status, payload, review_note, created_at, updated_at
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
    returning id, status, payload, review_note, created_at, updated_at
  `;
  return row ?? null;
}

