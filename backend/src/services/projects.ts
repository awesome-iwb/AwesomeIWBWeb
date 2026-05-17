import { sql } from "../db/client";
import { newSlug } from "../utils/slug";
import { normalizeProjectTags } from "../domain/projectTags";
import { normalizeProjectInput } from "../domain/normalizeProjectInput";

export type CategoryRow = {
  id: string;
  name: string;
  description: string;
  sort_index: number;
};

/**
 * Database row shape for the `projects` table.
 *
 * Notes:
 * - `ai_usage_state` is a stable tri-state (`unknown|over50|under50`) used by the frontend.
 * - `extra` is a JSON blob for infrequently-used fields to keep schema evolution flexible.
 */
export type ProjectRow = {
  id: string;
  slug: string;
  name: string;
  category_id: string | null;
  developer: string;
  status: string;
  version: string;
  ai_usage_state: string;
  description: string;
  keywords: string[];
  recommendation: string[];
  github_url: string;
  avatar: string;
  icon: string;
  banner: string;
  stars: number;
  language: string;
  last_update: string | null;
  github_is_fork: boolean;
  github_parent_url: string;
  github_source_url: string;
  extra: any;
  organization_id: string | null;
  developer_user_id: string | null;
  organization_name?: string | null;
  developer_user_name?: string | null;
};

/**
 * List categories ordered for navigation display.
 */
export async function listCategories() {
  return sql()<CategoryRow[]>`
    select id, name, description, sort_index
    from categories
    order by sort_index asc, name asc
  `;
}

/**
 * Fetch the full catalog used by the public homepage: categories + projects grouped by category.
 *
 * This keeps the frontend API simple (`GET /api/projects`) at the cost of returning more data.
 * The admin UI uses paginated endpoints instead.
 */
export async function getCatalog() {
  const categories = await listCategories();
  const projects = await sql()<ProjectRow[]>`
    select p.*, o.name as organization_name, u.name as developer_user_name
    from projects p
    left join organizations o on o.id = p.organization_id
    left join users u on u.id = p.developer_user_id
    order by p.name asc
  `;
  const normalizedProjects = projects.map(normalizeProjectTags);
  return {
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      projects: normalizedProjects.filter((p) => p.category_id === c.id)
    }))
  };
}

/**
 * Create a category.
 */
export async function createCategory(input: { name: string; description?: string; sort_index?: number }) {
  const [row] = await sql()<CategoryRow[]>`
    insert into categories (name, description, sort_index)
    values (${input.name}, ${input.description ?? ""}, ${input.sort_index ?? 0})
    returning id, name, description, sort_index
  `;
  return row;
}

/**
 * Resolve a category id by case-insensitive name matching.
 */
export async function findCategoryIdByName(name: string) {
  const rows = await sql()<Array<{ id: string }>>`
    select id from categories where lower(name) = lower(${name}) limit 1
  `;
  return rows[0]?.id ?? null;
}

/**
 * Ensure a category exists, returning its id.
 *
 * Used by import flows that provide category names rather than ids.
 */
export async function upsertCategoryByName(input: { name: string; description?: string }) {
  const existingId = await findCategoryIdByName(input.name);
  if (existingId) return { id: existingId };
  const created = await createCategory({ name: input.name, description: input.description ?? "" });
  return { id: created.id };
}

/**
 * Update a category by id.
 */
export async function updateCategory(id: string, input: Partial<Omit<CategoryRow, "id">>) {
  const [row] = await sql()<CategoryRow[]>`
    update categories
    set
      name = coalesce(${input.name ?? null}, name),
      description = coalesce(${input.description ?? null}, description),
      sort_index = coalesce(${input.sort_index ?? null}, sort_index),
      updated_at = now()
    where id = ${id}
    returning id, name, description, sort_index
  `;
  return row ?? null;
}

/**
 * Delete a category. Projects should be re-assigned by the caller if needed.
 */
export async function deleteCategory(id: string) {
  await sql()`delete from categories where id = ${id}`;
  return { success: true };
}

/**
 * Paginated admin list of projects with optional keyword / developer / name search.
 */
export async function listProjects(params: {
  q?: string;
  category?: string;
  sort?: "stars" | "updated" | "name";
  page?: number;
  pageSize?: number;
}) {
  const db = sql();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 50));
  const offset = (page - 1) * pageSize;

  const q = params.q?.trim();
  const category = params.category?.trim();
  const sort = params.sort ?? "name";

  const orderBy =
    sort === "stars"
      ? db`p.stars desc nulls last, p.name asc`
      : sort === "updated"
        ? db`p.last_update desc nulls last, p.name asc`
        : db`p.name asc`;

  const whereParts = [];
  if (q) whereParts.push(sql()`(p.name ilike ${"%" + q + "%"} or p.developer ilike ${"%" + q + "%"} or ${q} = any(p.keywords))`);
  if (category) whereParts.push(sql()`p.category_id = ${category}`);
  const where = whereParts.length ? sql().join(whereParts, sql()` and `) : sql()`true`;

  const items = await sql()<ProjectRow[]>`
    select p.*, o.name as organization_name, u.name as developer_user_name
    from projects p
    left join organizations o on o.id = p.organization_id
    left join users u on u.id = p.developer_user_id
    where ${where}
    order by ${orderBy}
    limit ${pageSize} offset ${offset}
  `;

  const [{ count }] = await sql()<Array<{ count: string }>>`
    select count(*)::text as count from projects p where ${where}
  `;

  return { items: items.map(normalizeProjectTags), page, pageSize, total: Number(count) };
}

/**
 * Fetch a project by its database id.
 */
export async function getProjectById(id: string) {
  const rows = await sql()<ProjectRow[]>`
    select p.*, o.name as organization_name, u.name as developer_user_name
    from projects p
    left join organizations o on o.id = p.organization_id
    left join users u on u.id = p.developer_user_id
    where p.id = ${id}
    limit 1
  `;
  return rows[0] ? normalizeProjectTags(rows[0]) : null;
}

/**
 * Fetch a project by either slug (preferred) or case-insensitive name.
 *
 * Slug lookup is exact, name lookup requires uniqueness (limit 2, require exactly 1 row).
 */
export async function getProjectByKey(key: string) {
  const keyTrim = key.trim();
  const bySlug = await sql()<ProjectRow[]>`
    select p.*, o.name as organization_name, u.name as developer_user_name
    from projects p
    left join organizations o on o.id = p.organization_id
    left join users u on u.id = p.developer_user_id
    where p.slug = ${keyTrim}
    limit 1
  `;
  if (bySlug[0]) return normalizeProjectTags(bySlug[0]);

  const byName = await sql()<ProjectRow[]>`
    select p.*, o.name as organization_name, u.name as developer_user_name
    from projects p
    left join organizations o on o.id = p.organization_id
    left join users u on u.id = p.developer_user_id
    where lower(p.name) = lower(${keyTrim})
    limit 2
  `;
  return byName.length === 1 ? normalizeProjectTags(byName[0]) : null;
}

/**
 * Create a project row.
 *
 * `slug` is auto-generated when missing. Most fields default to empty strings or empty arrays
 * to keep JSON serialization stable for the frontend.
 */
export async function createProject(input: Partial<ProjectRow> & { name: string }) {
  const slug = input.slug?.trim() || newSlug();
  const [row] = await sql()<ProjectRow[]>`
    insert into projects (slug, name, category_id, developer, status, version, ai_usage_state, description, keywords, recommendation, github_url, avatar, icon, banner, stars, language, last_update, github_is_fork, github_parent_url, github_source_url, extra, organization_id, developer_user_id)
    values (
      ${slug},
      ${input.name},
      ${input.category_id ?? null},
      ${input.developer ?? ""},
      ${input.status ?? ""},
      ${input.version ?? ""},
      ${input.ai_usage_state ?? "unknown"},
      ${input.description ?? ""},
      ${input.keywords ?? []},
      ${input.recommendation ?? []},
      ${input.github_url ?? ""},
      ${input.avatar ?? ""},
      ${input.icon ?? ""},
      ${input.banner ?? ""},
      ${input.stars ?? 0},
      ${input.language ?? ""},
      ${input.last_update ?? null}
      ,${input.github_is_fork ?? false}
      ,${input.github_parent_url ?? ""}
      ,${input.github_source_url ?? ""}
      ,${input.extra ?? {}}
      ,${input.organization_id ?? null}
      ,${input.developer_user_id ?? null}
    )
    returning id, slug, name, category_id, developer, status, version, ai_usage_state, description, keywords, recommendation, github_url, avatar, icon, banner, stars, language, last_update, github_is_fork, github_parent_url, github_source_url, extra, organization_id, developer_user_id
  `;
  return row;
}

/**
 * Fields any project member with `dev:project_edit` may change via `PATCH /api/dev/projects/:id`.
 * (Curatorial / catalog fields such as category and editors-choice stay admin-only.)
 */
export function extractDevProjectBaselinePatch(payload: unknown): Partial<ProjectRow> {
  if (!payload || typeof payload !== "object") return {};
  const p = payload as Record<string, unknown>;
  const n = normalizeProjectInput(p);
  const out: Partial<ProjectRow> = {};
  if (Object.prototype.hasOwnProperty.call(p, "name") && typeof n.name === "string") out.name = n.name;
  if (Object.prototype.hasOwnProperty.call(p, "description") && typeof n.description === "string") out.description = n.description;
  if (Object.prototype.hasOwnProperty.call(p, "github_url") && typeof n.github_url === "string") out.github_url = n.github_url;
  if (Object.prototype.hasOwnProperty.call(p, "language") && typeof n.language === "string") out.language = n.language;
  if (Object.prototype.hasOwnProperty.call(p, "status") && typeof n.status === "string") out.status = n.status;
  if (Object.prototype.hasOwnProperty.call(p, "version") && typeof n.version === "string") out.version = n.version;
  if (Object.prototype.hasOwnProperty.call(p, "keywords") && n.keywords !== undefined) out.keywords = n.keywords;
  return out;
}

function recommendationToArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return [];
}

/**
 * Media + metadata fields only allowed for project owner with `dev:project_admin`
 * (see `PATCH /api/dev/projects/:id` handler).
 */
export function extractDevProjectOwnerAdminPatch(payload: unknown): Partial<ProjectRow> {
  if (!payload || typeof payload !== "object") return {};
  const p = payload as Record<string, unknown>;
  const n = normalizeProjectInput(p);
  const out: Partial<ProjectRow> = {};
  if (Object.prototype.hasOwnProperty.call(p, "icon") && typeof n.icon === "string") out.icon = n.icon;
  if (Object.prototype.hasOwnProperty.call(p, "banner") && typeof n.banner === "string") out.banner = n.banner;
  if (Object.prototype.hasOwnProperty.call(p, "avatar") && typeof n.avatar === "string") out.avatar = n.avatar;
  if (Object.prototype.hasOwnProperty.call(p, "extra")) {
    out.extra = typeof p.extra === "object" && p.extra ? (p.extra as object) : (n.extra ?? {});
  }
  if (Object.prototype.hasOwnProperty.call(p, "stars") && n.stars !== undefined) out.stars = n.stars;
  if (Object.prototype.hasOwnProperty.call(p, "ai_usage_state") && typeof n.ai_usage_state === "string") out.ai_usage_state = n.ai_usage_state;
  if (Object.prototype.hasOwnProperty.call(p, "recommendation")) {
    const r = n.recommendation;
    out.recommendation = recommendationToArray(r !== undefined ? r : p.recommendation);
  }
  if (Object.prototype.hasOwnProperty.call(p, "last_update") && (n.last_update === null || typeof n.last_update === "string")) {
    out.last_update = n.last_update ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(p, "github_is_fork") && typeof n.github_is_fork === "boolean") out.github_is_fork = n.github_is_fork;
  if (Object.prototype.hasOwnProperty.call(p, "github_parent_url") && typeof n.github_parent_url === "string") out.github_parent_url = n.github_parent_url;
  if (Object.prototype.hasOwnProperty.call(p, "github_source_url") && typeof n.github_source_url === "string") out.github_source_url = n.github_source_url;
  return out;
}

/**
 * Update a project row by id.
 *
 * Uses `coalesce` for most fields so callers may send partial payloads.
 * `organization_id` and `developer_user_id` honor explicit `null` to clear when the key is present.
 */
export async function updateProject(id: string, input: Partial<ProjectRow>) {
  const hasOrg = Object.prototype.hasOwnProperty.call(input, "organization_id");
  const hasDev = Object.prototype.hasOwnProperty.call(input, "developer_user_id");
  const [row] = await sql()<ProjectRow[]>`
    update projects
    set
      name = coalesce(${input.name ?? null}, name),
      category_id = coalesce(${input.category_id ?? null}, category_id),
      developer = coalesce(${input.developer ?? null}, developer),
      status = coalesce(${input.status ?? null}, status),
      version = coalesce(${input.version ?? null}, version),
      ai_usage_state = coalesce(${input.ai_usage_state ?? null}, ai_usage_state),
      description = coalesce(${input.description ?? null}, description),
      keywords = coalesce(${input.keywords ?? null}, keywords),
      recommendation = coalesce(${input.recommendation ?? null}, recommendation),
      github_url = coalesce(${input.github_url ?? null}, github_url),
      avatar = coalesce(${input.avatar ?? null}, avatar),
      icon = coalesce(${input.icon ?? null}, icon),
      banner = coalesce(${input.banner ?? null}, banner),
      stars = coalesce(${input.stars ?? null}, stars),
      language = coalesce(${input.language ?? null}, language),
      last_update = coalesce(${input.last_update ?? null}, last_update),
      github_is_fork = coalesce(${input.github_is_fork ?? null}, github_is_fork),
      github_parent_url = coalesce(${input.github_parent_url ?? null}, github_parent_url),
      github_source_url = coalesce(${input.github_source_url ?? null}, github_source_url),
      extra = coalesce(${input.extra ?? null}, extra),
      organization_id = case when ${hasOrg} then ${input.organization_id ?? null} else projects.organization_id end,
      developer_user_id = case when ${hasDev} then ${input.developer_user_id ?? null} else projects.developer_user_id end,
      updated_at = now()
    where id = ${id}
    returning id, slug, name, category_id, developer, status, version, ai_usage_state, description, keywords, recommendation, github_url, avatar, icon, banner, stars, language, last_update, github_is_fork, github_parent_url, github_source_url, extra, organization_id, developer_user_id
  `;
  return row ?? null;
}

export async function deleteProject(id: string) {
  await sql()`delete from projects where id = ${id}`;
  return { success: true };
}

export async function findProjectIdBySlug(slug: string) {
  const rows = await sql()<Array<{ id: string }>>`select id from projects where slug = ${slug} limit 1`;
  return rows[0]?.id ?? null;
}

export async function findProjectIdByNameUnique(name: string) {
  const rows = await sql()<Array<{ id: string }>>`
    select id from projects where lower(name) = lower(${name}) limit 2
  `;
  if (rows.length !== 1) return null;
  return rows[0].id;
}

export async function upsertProjectBySlugOrName(input: Partial<ProjectRow> & { name: string }) {
  const slug = input.slug?.trim();
  if (slug) {
    const id = await findProjectIdBySlug(slug);
    if (id) return { action: "updated" as const, project: await updateProject(id, input) };
    return { action: "created" as const, project: await createProject({ ...input, slug }) };
  }

  const idByName = await findProjectIdByNameUnique(input.name);
  if (idByName) return { action: "updated" as const, project: await updateProject(idByName, input) };
  return { action: "created" as const, project: await createProject(input) };
}

export async function getStats() {
  const [{ totalProjects }] = await sql()<Array<{ totalProjects: number }>>`
    select count(*)::int as "totalProjects" from projects
  `;
  const [{ totalStars }] = await sql()<Array<{ totalStars: number }>>`
    select coalesce(sum(stars),0)::int as "totalStars" from projects
  `;
  return { totalProjects, totalStars };
}
