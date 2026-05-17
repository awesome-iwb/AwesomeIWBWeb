import { sql } from "../db/client";

const dbEnabled = Boolean(process.env.DATABASE_URL);

export type OrganizationStatus = "pending" | "approved" | "rejected" | "suspended";
export type OrgMemberRole = "owner" | "admin" | "member";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  avatar_url: string;
  description: string;
  website_url: string;
  status: OrganizationStatus;
  review_note: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type OrganizationMember = {
  org_id: string;
  user_id: string;
  role: OrgMemberRole;
  joined_at: string;
  user_name?: string | null;
  user_avatar_url?: string | null;
};

const ORG_COLUMNS = "id, name, slug, avatar_url, description, website_url, status, review_note, created_by, created_at, updated_at";
const ORG_MEMBER_COLUMNS = "org_id, user_id, role, joined_at";

export function generateOrgSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function validateOrgName(name: string): boolean {
  return name.length > 0 && name.length <= 100;
}

export async function createOrganization(input: {
  name: string;
  slug: string;
  description?: string;
  website_url?: string;
  created_by: string;
}): Promise<Organization> {
  const [row] = await sql()<Organization[]>`
    insert into organizations (name, slug, description, website_url, created_by)
    values (${input.name}, ${input.slug}, ${input.description ?? ""}, ${input.website_url ?? ""}, ${input.created_by})
    returning ${sql(ORG_COLUMNS)}
  `;
  await sql()`insert into organization_members (org_id, user_id, role) values (${row.id}, ${input.created_by}, 'owner')`;
  return row;
}

export async function findOrganizationById(id: string): Promise<Organization | null> {
  if (!dbEnabled) return null;
  const rows = await sql()<Organization[]>`
    select ${sql(ORG_COLUMNS)} from organizations where id = ${id} limit 1
  `;
  return rows[0] ?? null;
}

export async function findOrganizationBySlug(slug: string): Promise<Organization | null> {
  if (!dbEnabled) return null;
  const rows = await sql()<Organization[]>`
    select ${sql(ORG_COLUMNS)} from organizations where slug = ${slug} limit 1
  `;
  return rows[0] ?? null;
}

export async function listOrganizations(params: {
  q?: string;
  status?: OrganizationStatus;
  created_by?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: Organization[]; page: number; pageSize: number; total: number }> {
  if (!dbEnabled) return { items: [], page: 1, pageSize: 20, total: 0 };
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const whereParts: string[] = [];
  const queryParams: any[] = [];

  if (params.q) {
    queryParams.push(`%${params.q}%`);
    whereParts.push(`(name ilike $${queryParams.length} or slug ilike $${queryParams.length})`);
  }
  if (params.status) {
    queryParams.push(params.status);
    whereParts.push(`status = $${queryParams.length}`);
  }
  if (params.created_by) {
    queryParams.push(params.created_by);
    whereParts.push(`created_by = $${queryParams.length}`);
  }

  const whereClause = whereParts.length ? `where ${whereParts.join(" and ")}` : "";

  const items = await sql().unsafe(
    `select ${ORG_COLUMNS} from organizations ${whereClause} order by created_at desc limit ${pageSize} offset ${offset}`,
    queryParams
  ) as Organization[];

  const [{ count }] = await sql().unsafe(
    `select count(*)::text as count from organizations ${whereClause}`,
    queryParams
  ) as Array<{ count: string }>;

  return { items, page, pageSize, total: Number(count) };
}

export async function updateOrganizationStatus(id: string, status: OrganizationStatus, reviewNote?: string): Promise<Organization | null> {
  if (!dbEnabled) return null;
  const rows = await sql()<Organization[]>`
    update organizations set status = ${status}, review_note = ${reviewNote ?? ""}, updated_at = now()
    where id = ${id}
    returning ${sql(ORG_COLUMNS)}
  `;
  return rows[0] ?? null;
}

export async function updateOrganization(id: string, input: { name?: string; description?: string; website_url?: string; avatar_url?: string }): Promise<Organization | null> {
  if (!dbEnabled) return null;
  const sets: string[] = ["updated_at = now()"];
  const params: any[] = [];

  if (input.name !== undefined) { params.push(input.name); sets.push(`name = $${params.length}`); }
  if (input.description !== undefined) { params.push(input.description); sets.push(`description = $${params.length}`); }
  if (input.website_url !== undefined) { params.push(input.website_url); sets.push(`website_url = $${params.length}`); }
  if (input.avatar_url !== undefined) { params.push(input.avatar_url); sets.push(`avatar_url = $${params.length}`); }

  params.push(id);
  const rows = await sql().unsafe(
    `update organizations set ${sets.join(", ")} where id = $${params.length} returning ${ORG_COLUMNS}`,
    params
  ) as Organization[];
  return rows[0] ?? null;
}

export async function deleteOrganization(id: string): Promise<boolean> {
  if (!dbEnabled) return false;
  const result = await sql()`delete from organizations where id = ${id}`;
  return (result as any).rowCount > 0;
}

export async function getOrganizationMembers(orgId: string): Promise<OrganizationMember[]> {
  if (!dbEnabled) return [];
  return sql()<OrganizationMember[]>`
    select om.*, u.name as user_name, u.avatar_url as user_avatar_url
    from organization_members om
    left join users u on u.id = om.user_id
    where om.org_id = ${orgId}
    order by om.joined_at asc
  `;
}

export async function addOrganizationMember(input: { org_id: string; user_id: string; role?: OrgMemberRole }): Promise<OrganizationMember> {
  const [row] = await sql()<OrganizationMember[]>`
    insert into organization_members (org_id, user_id, role)
    values (${input.org_id}, ${input.user_id}, ${input.role ?? "member"})
    on conflict (org_id, user_id) do update set role = ${input.role ?? "member"}
    returning ${sql(ORG_MEMBER_COLUMNS)}
  `;
  return row;
}

export async function removeOrganizationMember(orgId: string, userId: string): Promise<boolean> {
  if (!dbEnabled) return false;
  const result = await sql()`delete from organization_members where org_id = ${orgId} and user_id = ${userId} and role != 'owner'`;
  return (result as any).rowCount > 0;
}

export async function updateOrganizationMemberRole(orgId: string, userId: string, role: OrgMemberRole): Promise<OrganizationMember | null> {
  if (!dbEnabled) return null;
  const rows = await sql()<OrganizationMember[]>`
    update organization_members set role = ${role}
    where org_id = ${orgId} and user_id = ${userId} and role != 'owner'
    returning ${sql(ORG_MEMBER_COLUMNS)}
  `;
  return rows[0] ?? null;
}

export async function getUserOrganizations(userId: string): Promise<Array<Organization & { member_role: OrgMemberRole }>> {
  if (!dbEnabled) return [];
  return sql()<Array<Organization & { member_role: OrgMemberRole }>>`
    select o.*, om.role as member_role
    from organizations o
    join organization_members om on om.org_id = o.id
    where om.user_id = ${userId} and o.status = 'approved'
    order by om.joined_at asc
  `;
}

export async function isOrgMember(orgId: string, userId: string): Promise<boolean> {
  if (!dbEnabled) return false;
  const rows = await sql()<Array<{ user_id: string }>>`
    select user_id from organization_members where org_id = ${orgId} and user_id = ${userId}
  `;
  return rows.length > 0;
}

export async function isOrgAdminOrAbove(orgId: string, userId: string): Promise<boolean> {
  if (!dbEnabled) return false;
  const rows = await sql()<Array<{ role: string }>>`
    select role from organization_members where org_id = ${orgId} and user_id = ${userId} and role in ('owner', 'admin')
  `;
  return rows.length > 0;
}
