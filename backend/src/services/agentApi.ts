import { sql } from "../db/client";
import { getTagsForProject, getTagsForProjects, type RegistryTagSummary } from "./tags";

const dbEnabled = Boolean(process.env.DATABASE_URL);

export type AgentSort = "name" | "stars" | "updated";

export type AgentPagination = {
  page: number;
  pageSize: number;
};

export type AgentProjectPublic = {
  id: string;
  slug: string;
  name: string;
  description: string;
  developer: string;
  category: { id: string | null; name: string; description: string } | null;
  keywords: string[];
  recommendation: string[];
  github_url: string;
  icon: string;
  banner: string;
  avatar: string;
  stars: number;
  language: string;
  status: string;
  version: string;
  last_update: string | null;
  ai_usage_state: string;
  registry_tags: RegistryTagSummary[];
  organization: { id: string; name: string } | null;
  developer_user: { id: string; name: string; avatar_url: string } | null;
};

export type AgentDeveloperPublic = {
  id: string;
  name: string;
  avatar_url: string;
  created_at: string;
  org_count: number;
  project_count: number;
  organizations: Array<{ id: string; name: string; slug: string; avatar_url: string }>;
};

export type AgentDeveloperDetailPublic = AgentDeveloperPublic & {
  projects: Array<{ id: string; name: string; slug: string; icon: string; role: string }>;
};

type AgentProjectRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  developer: string;
  category_id: string | null;
  category_name: string | null;
  category_description: string | null;
  keywords: string[] | null;
  recommendation: string[] | null;
  github_url: string;
  icon: string;
  banner: string;
  avatar: string;
  stars: number;
  language: string;
  status: string;
  version: string;
  last_update: string | null;
  ai_usage_state: string;
  organization_id: string | null;
  organization_name: string | null;
  developer_user_id: string | null;
  developer_user_name: string | null;
  developer_user_avatar_url: string | null;
};

export function normalizeAgentPagination(input: { page?: unknown; pageSize?: unknown }): AgentPagination {
  const pageRaw = typeof input.page === "number" ? input.page : Number(input.page);
  const pageSizeRaw = typeof input.pageSize === "number" ? input.pageSize : Number(input.pageSize);
  const page = Number.isFinite(pageRaw) ? Math.max(1, Math.floor(pageRaw)) : 1;
  const pageSize = Number.isFinite(pageSizeRaw) ? Math.min(100, Math.max(1, Math.floor(pageSizeRaw))) : 20;
  return { page, pageSize };
}

export function normalizeAgentSort(value: unknown): AgentSort {
  return value === "stars" || value === "updated" || value === "name" ? value : "name";
}

export function mapAgentProject(row: any, registryTags: RegistryTagSummary[] = []): AgentProjectPublic {
  return {
    id: String(row.id ?? ""),
    slug: String(row.slug ?? ""),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    developer: String(row.developer ?? ""),
    category: row.category_id || row.category_name
      ? {
          id: row.category_id ? String(row.category_id) : null,
          name: String(row.category_name ?? ""),
          description: String(row.category_description ?? ""),
        }
      : null,
    keywords: Array.isArray(row.keywords) ? row.keywords.map(String) : [],
    recommendation: Array.isArray(row.recommendation) ? row.recommendation.map(String) : [],
    github_url: String(row.github_url ?? ""),
    icon: String(row.icon ?? ""),
    banner: String(row.banner ?? ""),
    avatar: String(row.avatar ?? ""),
    stars: Number(row.stars ?? 0),
    language: String(row.language ?? ""),
    status: String(row.status ?? ""),
    version: String(row.version ?? ""),
    last_update: row.last_update ? String(row.last_update) : null,
    ai_usage_state: String(row.ai_usage_state ?? "unknown"),
    registry_tags: registryTags.map((tag) => ({
      id: tag.id,
      label: tag.label,
      group: tag.group,
      color_variant: tag.color_variant,
    })),
    organization: row.organization_id
      ? { id: String(row.organization_id), name: String(row.organization_name ?? "") }
      : null,
    developer_user: row.developer_user_id
      ? {
          id: String(row.developer_user_id),
          name: String(row.developer_user_name ?? ""),
          avatar_url: String(row.developer_user_avatar_url ?? ""),
        }
      : null,
  };
}

export function mapAgentDeveloperListItem(row: any): AgentDeveloperPublic {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    avatar_url: String(row.avatar_url ?? ""),
    created_at: String(row.created_at ?? ""),
    org_count: Number(row.org_count ?? 0),
    project_count: Number(row.project_count ?? 0),
    organizations: Array.isArray(row.organizations)
      ? row.organizations.map((org: any) => ({
          id: String(org.id ?? ""),
          name: String(org.name ?? ""),
          slug: String(org.slug ?? ""),
          avatar_url: String(org.avatar_url ?? ""),
        }))
      : [],
  };
}

export function mapAgentDeveloperDetail(row: any): AgentDeveloperDetailPublic {
  return {
    ...mapAgentDeveloperListItem(row),
    projects: Array.isArray(row.projects)
      ? row.projects.map((project: any) => ({
          id: String(project.id ?? ""),
          name: String(project.name ?? ""),
          slug: String(project.slug ?? ""),
          icon: String(project.icon ?? ""),
          role: String(project.role ?? ""),
        }))
      : [],
  };
}

function makeProjectFilters(params: { q?: string; category?: string; tag_id?: string }) {
  const db = sql();
  const q = params.q?.trim();
  const like = q ? `%${q}%` : null;
  const qFilter = like
    ? db`and (
        p.name ilike ${like}
        or p.developer ilike ${like}
        or p.description ilike ${like}
        or p.language ilike ${like}
        or exists (select 1 from unnest(p.keywords) keyword where keyword ilike ${like})
        or exists (select 1 from unnest(p.recommendation) recommendation where recommendation ilike ${like})
      )`
    : db``;
  const category = params.category?.trim();
  const categoryFilter = category ? db`and p.category_id = ${category}` : db``;
  const tagId = params.tag_id?.trim();
  const tagFilter = tagId
    ? db`and exists (select 1 from project_tag_links ptl where ptl.project_id = p.id and ptl.tag_id = ${tagId})`
    : db``;
  return { qFilter, categoryFilter, tagFilter };
}

export async function listAgentProjects(params: {
  q?: string;
  category?: string;
  tag_id?: string;
  sort?: AgentSort;
  page?: number;
  pageSize?: number;
}): Promise<{ items: AgentProjectPublic[]; page: number; pageSize: number; total: number }> {
  if (!dbEnabled) return { items: [], page: 1, pageSize: 20, total: 0 };

  const { page, pageSize } = normalizeAgentPagination(params);
  const offset = (page - 1) * pageSize;
  const sort = normalizeAgentSort(params.sort);
  const db = sql();
  const { qFilter, categoryFilter, tagFilter } = makeProjectFilters(params);
  const orderBy =
    sort === "stars"
      ? db`p.stars desc nulls last, p.name asc`
      : sort === "updated"
        ? db`p.last_update desc nulls last, p.name asc`
        : db`p.name asc`;

  const rows = await db<AgentProjectRow[]>`
    select
      p.id, p.slug, p.name, p.description, p.developer, p.category_id,
      c.name as category_name, c.description as category_description,
      p.keywords, p.recommendation, p.github_url, p.icon, p.banner, p.avatar,
      p.stars, p.language, p.status, p.version, p.last_update, p.ai_usage_state,
      p.organization_id, o.name as organization_name,
      p.developer_user_id, u.name as developer_user_name, u.avatar_url as developer_user_avatar_url
    from projects p
    left join categories c on c.id = p.category_id
    left join organizations o on o.id = p.organization_id and o.status = 'approved'
    left join users u on u.id = p.developer_user_id and u.is_active = true
    where true ${qFilter} ${categoryFilter} ${tagFilter}
    order by ${orderBy}
    limit ${pageSize} offset ${offset}
  `;

  const [{ count }] = await db<Array<{ count: string }>>`
    select count(*)::text as count
    from projects p
    where true ${qFilter} ${categoryFilter} ${tagFilter}
  `;

  const tagMap = await getTagsForProjects(rows.map((row) => row.id));
  return {
    items: rows.map((row) => mapAgentProject(row, tagMap.get(row.id) ?? [])),
    page,
    pageSize,
    total: Number(count),
  };
}

export async function getAgentProjectByKey(key: string): Promise<AgentProjectPublic | null> {
  if (!dbEnabled) return null;
  const db = sql();
  const trimmed = key.trim();
  const bySlug = await db<AgentProjectRow[]>`
    select
      p.id, p.slug, p.name, p.description, p.developer, p.category_id,
      c.name as category_name, c.description as category_description,
      p.keywords, p.recommendation, p.github_url, p.icon, p.banner, p.avatar,
      p.stars, p.language, p.status, p.version, p.last_update, p.ai_usage_state,
      p.organization_id, o.name as organization_name,
      p.developer_user_id, u.name as developer_user_name, u.avatar_url as developer_user_avatar_url
    from projects p
    left join categories c on c.id = p.category_id
    left join organizations o on o.id = p.organization_id and o.status = 'approved'
    left join users u on u.id = p.developer_user_id and u.is_active = true
    where p.slug = ${trimmed}
    limit 1
  `;
  let row: AgentProjectRow | null = bySlug[0] ?? null;
  if (!row) {
    const byName = await db<AgentProjectRow[]>`
      select
        p.id, p.slug, p.name, p.description, p.developer, p.category_id,
        c.name as category_name, c.description as category_description,
        p.keywords, p.recommendation, p.github_url, p.icon, p.banner, p.avatar,
        p.stars, p.language, p.status, p.version, p.last_update, p.ai_usage_state,
        p.organization_id, o.name as organization_name,
        p.developer_user_id, u.name as developer_user_name, u.avatar_url as developer_user_avatar_url
      from projects p
      left join categories c on c.id = p.category_id
      left join organizations o on o.id = p.organization_id and o.status = 'approved'
      left join users u on u.id = p.developer_user_id and u.is_active = true
      where lower(p.name) = lower(${trimmed})
      limit 2
    `;
    row = byName.length === 1 ? byName[0] ?? null : null;
  }
  if (!row) return null;
  const tags = await getTagsForProject(row.id);
  return mapAgentProject(row, tags);
}

function makeDeveloperFilter(q?: string) {
  const db = sql();
  const query = q?.trim();
  const like = query ? `%${query}%` : null;
  return like
    ? db`and (
        u.name ilike ${like}
        or exists (
          select 1
          from project_members pm
          join projects p on p.id = pm.project_id
          where pm.user_id = u.id and p.name ilike ${like}
        )
        or exists (
          select 1
          from organization_members om
          join organizations o on o.id = om.org_id
          where om.user_id = u.id and o.status = 'approved' and o.name ilike ${like}
        )
      )`
    : db``;
}

export async function listAgentDevelopers(params: {
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: AgentDeveloperPublic[]; page: number; pageSize: number; total: number }> {
  if (!dbEnabled) return { items: [], page: 1, pageSize: 20, total: 0 };

  const { page, pageSize } = normalizeAgentPagination(params);
  const offset = (page - 1) * pageSize;
  const db = sql();
  const qFilter = makeDeveloperFilter(params.q);

  const rows = await db<Array<any>>`
    select
      u.id, u.name, u.avatar_url, u.created_at,
      coalesce(orgs.org_count, 0)::int as org_count,
      coalesce(projects.project_count, 0)::int as project_count,
      coalesce(orgs.organizations, '[]'::json) as organizations
    from users u
    join user_capabilities uc on uc.user_id = u.id and uc.capability_id = 'dev_panel_access'
    left join lateral (
      select
        count(*)::int as org_count,
        json_agg(json_build_object('id', o.id, 'name', o.name, 'slug', o.slug, 'avatar_url', o.avatar_url) order by o.name asc) as organizations
      from organization_members om
      join organizations o on o.id = om.org_id
      where om.user_id = u.id and o.status = 'approved'
    ) orgs on true
    left join lateral (
      select count(*)::int as project_count from project_members pm where pm.user_id = u.id
    ) projects on true
    where u.is_active = true ${qFilter}
    order by u.created_at desc
    limit ${pageSize} offset ${offset}
  `;

  const [{ count }] = await db<Array<{ count: string }>>`
    select count(distinct u.id)::text as count
    from users u
    join user_capabilities uc on uc.user_id = u.id and uc.capability_id = 'dev_panel_access'
    where u.is_active = true ${qFilter}
  `;

  return {
    items: rows.map(mapAgentDeveloperListItem),
    page,
    pageSize,
    total: Number(count),
  };
}

export async function getAgentDeveloperById(id: string): Promise<AgentDeveloperDetailPublic | null> {
  if (!dbEnabled) return null;
  const db = sql();
  const rows = await db<Array<any>>`
    select
      u.id, u.name, u.avatar_url, u.created_at,
      coalesce(orgs.org_count, 0)::int as org_count,
      coalesce(projects.project_count, 0)::int as project_count,
      coalesce(orgs.organizations, '[]'::json) as organizations,
      coalesce(projects.projects, '[]'::json) as projects
    from users u
    join user_capabilities uc on uc.user_id = u.id and uc.capability_id = 'dev_panel_access'
    left join lateral (
      select
        count(*)::int as org_count,
        json_agg(json_build_object('id', o.id, 'name', o.name, 'slug', o.slug, 'avatar_url', o.avatar_url) order by o.name asc) as organizations
      from organization_members om
      join organizations o on o.id = om.org_id
      where om.user_id = u.id and o.status = 'approved'
    ) orgs on true
    left join lateral (
      select
        count(*)::int as project_count,
        json_agg(json_build_object('id', p.id, 'name', p.name, 'slug', p.slug, 'icon', p.icon, 'role', pm.role) order by p.name asc) as projects
      from project_members pm
      join projects p on p.id = pm.project_id
      where pm.user_id = u.id
    ) projects on true
    where u.id = ${id} and u.is_active = true
    limit 1
  `;

  return rows[0] ? mapAgentDeveloperDetail(rows[0]) : null;
}
