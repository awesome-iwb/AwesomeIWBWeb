import { sql } from "../db/client";

const dbEnabled = Boolean(process.env.DATABASE_URL);

export type ProjectMemberRole = "owner" | "collaborator";

export type ProjectMember = {
  project_id: string;
  user_id: string | null;
  org_id: string | null;
  role: ProjectMemberRole;
  joined_at: string;
};

export type ProjectMemberWithUser = ProjectMember & {
  user_name?: string;
  user_avatar_url?: string;
  org_name?: string;
  org_slug?: string;
  org_avatar_url?: string;
};

export async function addProjectMember(input: {
  project_id: string;
  user_id?: string;
  org_id?: string;
  role?: ProjectMemberRole;
}): Promise<ProjectMember> {
  const userId = input.user_id ?? null;
  const orgId = input.org_id ?? null;
  const [row] = await sql()<ProjectMember[]>`
    insert into project_members (project_id, user_id, org_id, role)
    values (${input.project_id}, ${userId}, ${orgId}, ${input.role ?? "collaborator"})
    returning project_id, user_id, org_id, role, joined_at
  `;
  return row;
}

export async function removeProjectMember(projectId: string, userId: string): Promise<boolean> {
  if (!dbEnabled) return false;
  const result = await sql()`delete from project_members where project_id = ${projectId} and user_id = ${userId} and role != 'owner'`;
  return (result as any).rowCount > 0;
}

export async function removeProjectOrgMember(projectId: string, orgId: string): Promise<boolean> {
  if (!dbEnabled) return false;
  const result = await sql()`delete from project_members where project_id = ${projectId} and org_id = ${orgId}`;
  return (result as any).rowCount > 0;
}

export async function getProjectMembers(projectId: string): Promise<ProjectMemberWithUser[]> {
  if (!dbEnabled) return [];
  return sql()<ProjectMemberWithUser[]>`
    select pm.*,
      u.name as user_name, u.avatar_url as user_avatar_url,
      o.name as org_name, o.slug as org_slug, o.avatar_url as org_avatar_url
    from project_members pm
    left join users u on u.id = pm.user_id
    left join organizations o on o.id = pm.org_id
    where pm.project_id = ${projectId}
    order by pm.role desc, pm.joined_at asc
  `;
}

export async function getUserProjects(userId: string): Promise<Array<{ project_id: string; role: ProjectMemberRole }>> {
  if (!dbEnabled) return [];
  const directProjects = await sql()<Array<{ project_id: string; role: ProjectMemberRole }>>`
    select project_id, role from project_members where user_id = ${userId}
  `;
  const orgMemberships = await sql()<Array<{ org_id: string }>>`
    select org_id from organization_members where user_id = ${userId}
  `;
  const orgIds = orgMemberships.map(m => m.org_id);
  let orgProjects: Array<{ project_id: string; role: ProjectMemberRole }> = [];
  if (orgIds.length > 0) {
    const values = orgIds.map(id => `'${id}'`).join(",");
    orgProjects = await sql().unsafe(
      `select project_id, role from project_members where org_id in (${values})`
    ) as Array<{ project_id: string; role: ProjectMemberRole }>;
  }
  const map = new Map<string, ProjectMemberRole>();
  for (const p of [...directProjects, ...orgProjects]) {
    if (!map.has(p.project_id) || p.role === "owner") {
      map.set(p.project_id, p.role);
    }
  }
  return Array.from(map.entries()).map(([project_id, role]) => ({ project_id, role }));
}

export async function isProjectMember(projectId: string, userId: string): Promise<boolean> {
  if (!dbEnabled) return false;
  const directRows = await sql()<Array<{ project_id: string }>>`
    select project_id from project_members where project_id = ${projectId} and user_id = ${userId}
  `;
  if (directRows.length > 0) return true;
  const orgRows = await sql()<Array<{ org_id: string }>>`
    select pm.org_id from project_members pm
    join organization_members om on om.org_id = pm.org_id
    where pm.project_id = ${projectId} and om.user_id = ${userId}
  `;
  return orgRows.length > 0;
}

export async function isProjectOwner(projectId: string, userId: string): Promise<boolean> {
  if (!dbEnabled) return false;
  const directRows = await sql()<Array<{ project_id: string }>>`
    select project_id from project_members where project_id = ${projectId} and user_id = ${userId} and role = 'owner'
  `;
  if (directRows.length > 0) return true;
  const orgRows = await sql()<Array<{ org_id: string }>>`
    select pm.org_id from project_members pm
    join organization_members om on om.org_id = pm.org_id and om.role in ('owner', 'admin')
    where pm.project_id = ${projectId} and pm.role = 'owner' and om.user_id = ${userId}
  `;
  return orgRows.length > 0;
}

export async function hasAnyProjectMembership(userId: string): Promise<boolean> {
  if (!dbEnabled) return false;
  const directRows = await sql()<Array<{ count: string }>>`
    select count(*)::text as count from project_members where user_id = ${userId}
  `;
  if (Number(directRows[0]?.count ?? 0) > 0) return true;
  const orgRows = await sql()<Array<{ count: string }>>`
    select count(*)::text as count from organization_members where user_id = ${userId}
  `;
  return Number(orgRows[0]?.count ?? 0) > 0;
}

/** User row in project_members (not org delegation). */
export async function isDirectUserProjectOwner(projectId: string, userId: string): Promise<boolean> {
  if (!dbEnabled) return false;
  const rows = await sql()<Array<{ project_id: string }>>`
    select project_id from project_members
    where project_id = ${projectId} and user_id = ${userId} and org_id is null and role = 'owner'
  `;
  return rows.length > 0;
}

/** Insert or upgrade a user row to owner (user-targeted membership only). */
export async function ensureUserProjectOwnerMembership(projectId: string, userId: string): Promise<void> {
  if (!dbEnabled) return;
  const existing = await sql()<Array<{ role: string }>>`
    select role from project_members
    where project_id = ${projectId} and user_id = ${userId} and org_id is null
    limit 1
  `;
  if (existing.length === 0) {
    await addProjectMember({ project_id: projectId, user_id: userId, role: "owner" });
  } else if (existing[0].role !== "owner") {
    await sql()`
      update project_members set role = 'owner'
      where project_id = ${projectId} and user_id = ${userId} and org_id is null
    `;
  }
}

export type TransferOwnershipResult =
  | { ok: true }
  | { ok: false; error: "NOT_OWNER" | "NOT_COLLABORATOR" | "SAME_USER" | "NO_DB" };

/**
 * Current user must be direct (user_id) owner. Target must be an existing collaborator on the same project.
 * Runs in a single transaction: old owner → collaborator, new owner → owner; updates projects.developer_user_id.
 */
export async function transferProjectUserOwnership(
  projectId: string,
  actorUserId: string,
  newOwnerUserId: string
): Promise<TransferOwnershipResult> {
  if (!dbEnabled) return { ok: false, error: "NO_DB" };
  if (actorUserId === newOwnerUserId) return { ok: false, error: "SAME_USER" };
  const ownerOk = await isDirectUserProjectOwner(projectId, actorUserId);
  if (!ownerOk) return { ok: false, error: "NOT_OWNER" };
  const target = await sql()<Array<{ role: string }>>`
    select role from project_members
    where project_id = ${projectId} and user_id = ${newOwnerUserId} and org_id is null
    limit 1
  `;
  if (!target.length || target[0].role !== "collaborator") {
    return { ok: false, error: "NOT_COLLABORATOR" };
  }
  const db = sql();
  await db.begin(async (tx) => {
    await tx`
      update project_members set role = 'collaborator'
      where project_id = ${projectId} and user_id = ${actorUserId} and org_id is null and role = 'owner'
    `;
    await tx`
      update project_members set role = 'owner'
      where project_id = ${projectId} and user_id = ${newOwnerUserId} and org_id is null
    `;
    await tx`
      update projects set developer_user_id = ${newOwnerUserId}, updated_at = now()
      where id = ${projectId}
    `;
  });
  return { ok: true };
}
