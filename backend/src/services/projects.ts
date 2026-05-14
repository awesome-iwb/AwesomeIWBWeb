import { sql } from "../db/client";
import { newSlug } from "../utils/slug";
import { normalizeProjectTags } from "../domain/projectTags";

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
    select id, slug, name, category_id, developer, status, version, ai_usage_state, description, keywords, recommendation, github_url, avatar, icon, banner, stars, language, last_update, github_is_fork, github_parent_url, github_source_url, extra
    from projects
    order by name asc
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
      ? db`stars desc nulls last, name asc`
      : sort === "updated"
        ? db`last_update desc nulls last, name asc`
        : db`name asc`;

  const whereParts = [];
  if (q) whereParts.push(sql()`(name ilike ${"%" + q + "%"} or developer ilike ${"%" + q + "%"} or ${q} = any(keywords))`);
  if (category) whereParts.push(sql()`category_id = ${category}`);
  const where = whereParts.length ? sql().join(whereParts, sql()` and `) : sql()`true`;

  const items = await sql()<ProjectRow[]>`
    select id, slug, name, category_id, developer, status, version, ai_usage_state, description, keywords, recommendation, github_url, avatar, icon, banner, stars, language, last_update, github_is_fork, github_parent_url, github_source_url, extra
    from projects
    where ${where}
    order by ${orderBy}
    limit ${pageSize} offset ${offset}
  `;

  const [{ count }] = await sql()<Array<{ count: string }>>`
    select count(*)::text as count from projects where ${where}
  `;

  return { items: items.map(normalizeProjectTags), page, pageSize, total: Number(count) };
}

/**
 * Fetch a project by its database id.
 */
export async function getProjectById(id: string) {
  const rows = await sql()<ProjectRow[]>`
    select id, slug, name, category_id, developer, status, version, ai_usage_state, description, keywords, recommendation, github_url, avatar, icon, banner, stars, language, last_update, github_is_fork, github_parent_url, github_source_url, extra
    from projects
    where id = ${id}
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
    select id, slug, name, category_id, developer, status, version, ai_usage_state, description, keywords, recommendation, github_url, avatar, icon, banner, stars, language, last_update, github_is_fork, github_parent_url, github_source_url, extra
    from projects
    where slug = ${keyTrim}
    limit 1
  `;
  if (bySlug[0]) return normalizeProjectTags(bySlug[0]);

  const byName = await sql()<ProjectRow[]>`
    select id, slug, name, category_id, developer, status, version, ai_usage_state, description, keywords, recommendation, github_url, avatar, icon, banner, stars, language, last_update, github_is_fork, github_parent_url, github_source_url, extra
    from projects
    where lower(name) = lower(${keyTrim})
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
    insert into projects (slug, name, category_id, developer, status, version, ai_usage_state, description, keywords, recommendation, github_url, avatar, icon, banner, stars, language, last_update, github_is_fork, github_parent_url, github_source_url, extra)
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
    )
    returning id, slug, name, category_id, developer, status, version, ai_usage_state, description, keywords, recommendation, github_url, avatar, icon, banner, stars, language, last_update, github_is_fork, github_parent_url, github_source_url, extra
  `;
  return row;
}

/**
 * Update a project row by id.
 *
 * The update uses `coalesce` so callers may send partial payloads.
 */
export async function updateProject(id: string, input: Partial<ProjectRow>) {
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
      updated_at = now()
    where id = ${id}
    returning id, slug, name, category_id, developer, status, version, ai_usage_state, description, keywords, recommendation, github_url, avatar, icon, banner, stars, language, last_update, github_is_fork, github_parent_url, github_source_url, extra
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
