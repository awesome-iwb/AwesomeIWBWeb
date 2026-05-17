import { sql } from "../db/client";

const dbEnabled = Boolean(process.env.DATABASE_URL);

export type DeveloperListItem = {
  id: string;
  name: string;
  avatar_url: string;
  email: string | null;
  created_at: string;
  org_count: number;
  project_count: number;
  organizations: Array<{ id: string; name: string; slug: string; avatar_url: string }>;
};

export async function listDevelopers(params: {
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: DeveloperListItem[]; page: number; pageSize: number; total: number }> {
  if (!dbEnabled) return { items: [], page: 1, pageSize: 20, total: 0 };

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const whereParts: string[] = [
    "uc.capability_id = 'dev_panel_access'",
    "u.is_active = true",
  ];
  const queryParams: any[] = [];

  if (params.q) {
    queryParams.push(`%${params.q}%`);
    whereParts.push(`u.name ilike $${queryParams.length}`);
  }

  const whereClause = `where ${whereParts.join(" and ")}`;

  const users = await sql().unsafe(
    `select distinct u.id, u.name, u.avatar_url, u.email, u.created_at from users u join user_capabilities uc on uc.user_id = u.id ${whereClause} order by u.created_at desc limit ${pageSize} offset ${offset}`,
    queryParams
  ) as Array<{ id: string; name: string; avatar_url: string; email: string | null; created_at: string }>;

  const [{ count }] = await sql().unsafe(
    `select count(distinct u.id)::text as count from users u join user_capabilities uc on uc.user_id = u.id ${whereClause}`,
    queryParams
  ) as Array<{ count: string }>;

  const items: DeveloperListItem[] = [];

  for (const u of users) {
    const orgRows = await sql()<Array<{ id: string; name: string; slug: string; avatar_url: string }>>`
      select o.id, o.name, o.slug, o.avatar_url
      from organization_members om
      join organizations o on o.id = om.org_id
      where om.user_id = ${u.id} and o.status = 'approved'
    `;

    const [{ org_count }] = await sql()<Array<{ org_count: string }>>`
      select count(*)::text as org_count
      from organization_members om
      join organizations o on o.id = om.org_id
      where om.user_id = ${u.id} and o.status = 'approved'
    `;

    const [{ project_count }] = await sql()<Array<{ project_count: string }>>`
      select count(*)::text as project_count
      from project_members pm
      where pm.user_id = ${u.id}
    `;

    items.push({
      id: u.id,
      name: u.name,
      avatar_url: u.avatar_url,
      email: u.email,
      created_at: u.created_at,
      org_count: Number(org_count),
      project_count: Number(project_count),
      organizations: orgRows,
    });
  }

  return { items, page, pageSize, total: Number(count) };
}

export type DeveloperDetail = {
  id: string;
  name: string;
  avatar_url: string;
  avatar?: string;
  email: string | null;
  role: string;
  created_at: string;
  organizations: Array<{ id: string; name: string; slug: string; avatar_url: string; avatar?: string; role: string }>;
  projects: Array<{ id: string; name: string; slug: string; icon: string; role: string }>;
};

export async function getDeveloperDetail(userId: string): Promise<DeveloperDetail | null> {
  if (!dbEnabled) return null;

  const devCheck = await sql()<Array<{ id: string }>>`
    select u.id from users u
    join user_capabilities uc on uc.user_id = u.id
    where u.id = ${userId} and uc.capability_id = 'dev_panel_access' and u.is_active = true
    limit 1
  `;
  if (!devCheck.length) return null;

  const [u] = await sql()<Array<{ id: string; name: string; avatar_url: string; email: string | null; role: string; created_at: string }>>`
    select id, name, avatar_url, email, role, created_at from users where id = ${userId} limit 1
  `;
  if (!u) return null;

  const orgRows = await sql()<Array<{ id: string; name: string; slug: string; avatar_url: string; role: string }>>`
    select o.id, o.name, o.slug, o.avatar_url, om.role
    from organization_members om
    join organizations o on o.id = om.org_id
    where om.user_id = ${userId} and o.status = 'approved'
    order by o.name asc
  `;

  const projectRows = await sql()<Array<{ id: string; name: string; slug: string; icon: string; role: string }>>`
    select p.id, p.name, p.slug, p.icon, pm.role
    from project_members pm
    join projects p on p.id = pm.project_id
    where pm.user_id = ${userId} and pm.org_id is null
    order by p.name asc
  `;

  return {
    id: u.id,
    name: u.name,
    avatar_url: u.avatar_url,
    avatar: u.avatar_url,
    email: u.email,
    role: u.role,
    created_at: u.created_at,
    organizations: orgRows.map((o) => ({
      ...o,
      avatar: o.avatar_url,
    })),
    projects: projectRows,
  };
}
