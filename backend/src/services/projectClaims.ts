import { sql } from "../db/client";
import { addProjectMember } from "./projectMembers";
import { promoteToDev } from "./rolePromotion";

const dbEnabled = Boolean(process.env.DATABASE_URL);

export type ClaimStatus = "pending" | "approved" | "rejected";

export type ProjectClaim = {
  id: string;
  project_id: string;
  user_id: string;
  message: string;
  status: ClaimStatus;
  review_note: string;
  created_at: string;
  reviewed_at: string | null;
};

export async function createProjectClaim(input: {
  project_id: string;
  user_id: string;
  message?: string;
}): Promise<ProjectClaim> {
  const [row] = await sql()<ProjectClaim[]>`
    insert into project_claims (project_id, user_id, message)
    values (${input.project_id}, ${input.user_id}, ${input.message ?? ""})
    returning id, project_id, user_id, message, status, review_note, created_at, reviewed_at
  `;
  return row;
}

export async function listProjectClaims(params: {
  status?: ClaimStatus;
  user_id?: string;
  project_id?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: ProjectClaim[]; page: number; pageSize: number; total: number }> {
  if (!dbEnabled) return { items: [], page: 1, pageSize: 20, total: 0 };
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const db = sql();
  const statusFilter = params.status ? db`and status = ${params.status}` : db``;
  const userFilter = params.user_id ? db`and user_id = ${params.user_id}` : db``;
  const projectFilter = params.project_id ? db`and project_id = ${params.project_id}` : db``;

  const items = await db<ProjectClaim[]>`
    select id, project_id, user_id, message, status, review_note, created_at, reviewed_at
    from project_claims
    where true ${statusFilter} ${userFilter} ${projectFilter}
    order by created_at desc
    limit ${pageSize} offset ${offset}
  `;

  const [{ count }] = await db<Array<{ count: string }>>`
    select count(*)::text as count
    from project_claims
    where true ${statusFilter} ${userFilter} ${projectFilter}
  `;

  return { items, page, pageSize, total: Number(count) };
}

export async function approveProjectClaim(claimId: string, reviewNote?: string): Promise<ProjectClaim | null> {
  if (!dbEnabled) return null;
  const [claim] = await sql()<ProjectClaim[]>`
    update project_claims set status = 'approved', review_note = ${reviewNote ?? ""}, reviewed_at = now()
    where id = ${claimId} and status = 'pending'
    returning id, project_id, user_id, message, status, review_note, created_at, reviewed_at
  `;
  if (!claim) return null;
  await addProjectMember({ project_id: claim.project_id, user_id: claim.user_id, role: "owner" });
  await promoteToDev(claim.user_id);
  return claim;
}

export async function rejectProjectClaim(claimId: string, reviewNote?: string): Promise<ProjectClaim | null> {
  if (!dbEnabled) return null;
  const rows = await sql()<ProjectClaim[]>`
    update project_claims set status = 'rejected', review_note = ${reviewNote ?? ""}, reviewed_at = now()
    where id = ${claimId} and status = 'pending'
    returning id, project_id, user_id, message, status, review_note, created_at, reviewed_at
  `;
  return rows[0] ?? null;
}
