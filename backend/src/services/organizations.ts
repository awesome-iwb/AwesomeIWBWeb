import { sql } from "../db/client";
import { normalizeInternalUploadUrl, normalizePublicWebsiteUrl } from "../domain/urlSafety";

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

export function normalizeOrganizationWebsiteUrl(value: unknown): string {
  return normalizePublicWebsiteUrl(value);
}

export function normalizeOrganizationAvatarUrl(value: unknown): string {
  return normalizeInternalUploadUrl(value);
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
    values (${input.name}, ${input.slug}, ${input.description ?? ""}, ${normalizeOrganizationWebsiteUrl(input.website_url)}, ${input.created_by})
    returning id, name, slug, avatar_url, description, website_url, status, review_note, created_by, created_at, updated_at
  `;
  await sql()`insert into organization_members (org_id, user_id, role) values (${row.id}, ${input.created_by}, 'owner')`;
  return row;
}

export async function findOrganizationById(id: string): Promise<Organization | null> {
  if (!dbEnabled) return null;
  const rows = await sql()<Organization[]>`
    select id, name, slug, avatar_url, description, website_url, status, review_note, created_by, created_at, updated_at
    from organizations where id = ${id} limit 1
  `;
  return rows[0] ?? null;
}

export async function findOrganizationBySlug(slug: string): Promise<Organization | null> {
  if (!dbEnabled) return null;
  const rows = await sql()<Organization[]>`
    select id, name, slug, avatar_url, description, website_url, status, review_note, created_by, created_at, updated_at
    from organizations where slug = ${slug} limit 1
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

  const db = sql();
  const q = params.q?.trim();
  const qFilter = q ? db`and (name ilike ${`%${q}%`} or slug ilike ${`%${q}%`})` : db``;
  const statusFilter = params.status ? db`and status = ${params.status}` : db``;
  const createdByFilter = params.created_by ? db`and created_by = ${params.created_by}` : db``;

  const items = await db<Organization[]>`
    select id, name, slug, avatar_url, description, website_url, status, review_note, created_by, created_at, updated_at
    from organizations
    where true ${qFilter} ${statusFilter} ${createdByFilter}
    order by created_at desc
    limit ${pageSize} offset ${offset}
  `;

  const [{ count }] = await db<Array<{ count: string }>>`
    select count(*)::text as count
    from organizations
    where true ${qFilter} ${statusFilter} ${createdByFilter}
  `;

  return { items, page, pageSize, total: Number(count) };
}

export async function updateOrganizationStatus(id: string, status: OrganizationStatus, reviewNote?: string): Promise<Organization | null> {
  if (!dbEnabled) return null;
  const rows = await sql()<Organization[]>`
    update organizations set status = ${status}, review_note = ${reviewNote ?? ""}, updated_at = now()
    where id = ${id}
    returning id, name, slug, avatar_url, description, website_url, status, review_note, created_by, created_at, updated_at
  `;
  return rows[0] ?? null;
}

export async function updateOrganization(id: string, input: { name?: string; description?: string; website_url?: string; avatar_url?: string }): Promise<Organization | null> {
  if (!dbEnabled) return null;
  const websiteUrl = input.website_url !== undefined ? normalizeOrganizationWebsiteUrl(input.website_url) : undefined;
  const avatarUrl = input.avatar_url !== undefined ? normalizeOrganizationAvatarUrl(input.avatar_url) : undefined;
  const [row] = await sql()<Organization[]>`
    update organizations
    set updated_at = now(),
        name = case when ${input.name !== undefined} then ${input.name ?? null} else name end,
        description = case when ${input.description !== undefined} then ${input.description ?? null} else description end,
        website_url = case when ${input.website_url !== undefined} then ${websiteUrl ?? null} else website_url end,
        avatar_url = case when ${input.avatar_url !== undefined} then ${avatarUrl ?? null} else avatar_url end
    where id = ${id}
    returning id, name, slug, avatar_url, description, website_url, status, review_note, created_by, created_at, updated_at
  `;
  return row ?? null;
}

export async function deleteOrganization(id: string): Promise<boolean> {
  if (!dbEnabled) return false;
  const rows = await sql()<Array<{ id: string }>>`
    delete from organizations where id = ${id}
    returning id
  `;
  return rows.length > 0;
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
    returning org_id, user_id, role, joined_at
  `;
  return row;
}

export async function removeOrganizationMember(orgId: string, userId: string): Promise<boolean> {
  if (!dbEnabled) return false;
  const rows = await sql()<Array<{ org_id: string }>>`
    delete from organization_members
    where org_id = ${orgId} and user_id = ${userId} and role != 'owner'
    returning org_id
  `;
  return rows.length > 0;
}

export async function updateOrganizationMemberRole(orgId: string, userId: string, role: OrgMemberRole): Promise<OrganizationMember | null> {
  if (!dbEnabled) return null;
  const rows = await sql()<OrganizationMember[]>`
    update organization_members set role = ${role}
    where org_id = ${orgId} and user_id = ${userId} and role != 'owner'
    returning org_id, user_id, role, joined_at
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
