import { sql } from "../db/client";
import { newSlug } from "../utils/slug";
import { normalizeProjectTags } from "../domain/projectTags";
import { attachRegistryTagsToCatalog } from "./tags";
import { normalizeProjectInput } from "../domain/normalizeProjectInput";
import { normalizeInternalUploadUrl } from "../domain/urlSafety";

export type CategoryRow = {
  id: string;
  name: string;
  description: string;
  sort_index: number;
};

export const UNCATEGORIZED_CATEGORY_ID = "00000000-0000-0000-0000-000000000001";
export const UNCATEGORIZED_CATEGORY_NAME = "未分类";
export const UNCATEGORIZED_CATEGORY_DESCRIPTION = "未选择分类，或原分类已删除的项目。";
export const UNCATEGORIZED_CATEGORY_SORT_INDEX = 2147483647;

export function isUncategorizedCategoryId(id: unknown): boolean {
  return String(id ?? "") === UNCATEGORIZED_CATEGORY_ID;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isUncategorizedCategoryName(name: unknown): boolean {
  const normalized = String(name ?? "").trim().toLowerCase();
  return normalized === UNCATEGORIZED_CATEGORY_NAME || normalized === "uncategorized";
}

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
  github_synced_at?: string | null;
  github_sync_error?: string;
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
 * Ensure the system fallback category exists.
 *
 * Category assignment is not optional from the product perspective: projects without a
 * valid category must remain visible under the stable "未分类" bucket.
 */
export async function ensureUncategorizedCategory() {
  const [row] = await sql()<CategoryRow[]>`
    insert into categories (id, name, description, sort_index)
    values (
      ${UNCATEGORIZED_CATEGORY_ID},
      ${UNCATEGORIZED_CATEGORY_NAME},
      ${UNCATEGORIZED_CATEGORY_DESCRIPTION},
      ${UNCATEGORIZED_CATEGORY_SORT_INDEX}
    )
    on conflict (id) do update
      set name = ${UNCATEGORIZED_CATEGORY_NAME},
          description = case
            when trim(categories.description) = '' then ${UNCATEGORIZED_CATEGORY_DESCRIPTION}
            else categories.description
          end,
          sort_index = ${UNCATEGORIZED_CATEGORY_SORT_INDEX},
          updated_at = now()
    returning id, name, description, sort_index
  `;
  return row;
}

export async function backfillUncategorizedProjects() {
  await ensureUncategorizedCategory();
  const rows = await sql()<Array<{ id: string }>>`
    update projects
    set category_id = ${UNCATEGORIZED_CATEGORY_ID},
        updated_at = now()
    where category_id is null
       or not exists (select 1 from categories c where c.id = projects.category_id)
    returning id
  `;
  return rows.length;
}

async function categoryExists(id: string) {
  const rows = await sql()<Array<{ id: string }>>`
    select id from categories where id = ${id} limit 1
  `;
  return rows.length > 0;
}

export async function resolveCategoryIdOrUncategorized(id: unknown) {
  const value = typeof id === "string" ? id.trim() : "";
  if (value && isUuid(value) && await categoryExists(value)) return value;
  const fallback = await ensureUncategorizedCategory();
  return fallback.id;
}

function attachOrphansToUncategorized(categories: CategoryRow[], projects: ProjectRow[]) {
  const categoryIds = new Set(categories.map((c) => c.id));
  const hasFallback = categoryIds.has(UNCATEGORIZED_CATEGORY_ID);
  const fallbackCategory =
    categories.find((c) => c.id === UNCATEGORIZED_CATEGORY_ID) ?? {
      id: UNCATEGORIZED_CATEGORY_ID,
      name: UNCATEGORIZED_CATEGORY_NAME,
      description: UNCATEGORIZED_CATEGORY_DESCRIPTION,
      sort_index: UNCATEGORIZED_CATEGORY_SORT_INDEX,
    };
  const orphanProjects = projects.filter((p) => !p.category_id || !categoryIds.has(p.category_id));
  const visibleCategories = hasFallback || orphanProjects.length === 0
    ? categories
    : [...categories, fallbackCategory];

  return visibleCategories
    .slice()
    .sort((a, b) => a.sort_index - b.sort_index || a.name.localeCompare(b.name))
    .map((c) => {
      const categoryProjects = c.id === UNCATEGORIZED_CATEGORY_ID && !hasFallback
        ? []
        : projects.filter((p) => p.category_id === c.id);
      const fallbackProjects = c.id === UNCATEGORIZED_CATEGORY_ID
        ? orphanProjects.map((p) => ({ ...p, category_id: UNCATEGORIZED_CATEGORY_ID }))
        : [];
      return {
        id: c.id,
        name: c.name,
        description: c.description,
        projects: [...categoryProjects, ...fallbackProjects],
      };
    });
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
  const grouped = attachOrphansToUncategorized(categories, normalizedProjects);
  const enriched = await attachRegistryTagsToCatalog(grouped);
  return { categories: enriched };
}

/**
 * Create a category.
 */
export async function createCategory(input: { name: string; description?: string; sort_index?: number }) {
  if (isUncategorizedCategoryName(input.name)) return ensureUncategorizedCategory();
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
  if (isUncategorizedCategoryName(name)) {
    const fallback = await ensureUncategorizedCategory();
    return fallback.id;
  }
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
  if (isUncategorizedCategoryId(id)) {
    const fallback = await ensureUncategorizedCategory();
    return fallback;
  }
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
 * Delete a category after moving its projects into the system fallback category.
 */
export async function deleteCategory(id: string) {
  if (isUncategorizedCategoryId(id)) {
    throw new Error("CANNOT_DELETE_UNCATEGORIZED_CATEGORY");
  }

  const existing = await sql()<CategoryRow[]>`
    select id, name, description, sort_index
    from categories
    where id = ${id}
    limit 1
  `;
  if (!existing[0]) return null;

  const fallback = await ensureUncategorizedCategory();
  const moved = await sql()<Array<{ id: string }>>`
    update projects
    set category_id = ${fallback.id},
        updated_at = now()
    where category_id = ${id}
    returning id
  `;
  await sql()`delete from categories where id = ${id}`;
  return { success: true, moved_projects: moved.length };
}

/**
 * Paginated admin list of projects with optional keyword / developer / name search.
 */
export async function listProjects(params: {
  q?: string;
  category?: string;
  tag_id?: string;
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
  const tagId = params.tag_id?.trim();
  const sort = params.sort ?? "name";
  const hasInvalidCategoryFilter = Boolean(category && !isUuid(category));

  const orderBy =
    sort === "stars"
      ? db`p.stars desc nulls last, p.name asc`
      : sort === "updated"
        ? db`p.last_update desc nulls last, p.name asc`
        : db`p.name asc`;

  const qFilter = q
    ? db`and (p.name ilike ${"%" + q + "%"} or p.developer ilike ${"%" + q + "%"} or ${q} = any(p.keywords))`
    : db``;
  const categoryFilter = category
    ? hasInvalidCategoryFilter
      ? db`and false`
      : isUncategorizedCategoryId(category)
      ? db`and (
          p.category_id = ${UNCATEGORIZED_CATEGORY_ID}
          or p.category_id is null
          or not exists (select 1 from categories c where c.id = p.category_id)
        )`
      : db`and p.category_id = ${category}`
    : db``;
  const tagFilter = tagId
    ? db`and p.id in (select project_id from project_tag_links where tag_id = ${tagId})`
    : db``;

  const items = await sql()<ProjectRow[]>`
    select p.*, o.name as organization_name, u.name as developer_user_name
    from projects p
    left join organizations o on o.id = p.organization_id
    left join users u on u.id = p.developer_user_id
    where true ${qFilter} ${categoryFilter} ${tagFilter}
    order by ${orderBy}
    limit ${pageSize} offset ${offset}
  `;

  const [{ count }] = await sql()<Array<{ count: string }>>`
    select count(*)::text as count from projects p where true ${qFilter} ${categoryFilter} ${tagFilter}
  `;

  const normalized = items.map(normalizeProjectTags);
  const { getTagsForProjects } = await import("./tags");
  const tagMap = await getTagsForProjects(normalized.map((p) => p.id).filter(Boolean));
  const enriched = normalized.map((p) => {
    const tags = tagMap.get(p.id) ?? [];
    return {
      ...p,
      tag_ids: tags.map((t) => t.id),
      registry_tags: tags.slice(0, 5).map((t) => ({
        id: t.id,
        label: t.label,
        group: t.group,
        color_variant: t.color_variant,
      })),
    };
  });

  return { items: enriched, page, pageSize, total: Number(count) };
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
  const safeInput = normalizeProjectForStorage(input) as Partial<ProjectRow> & { name: string };
  const slug = safeInput.slug?.trim() || newSlug();
  const categoryId = await resolveCategoryIdOrUncategorized(safeInput.category_id);
  const [row] = await sql()<ProjectRow[]>`
    insert into projects (slug, name, category_id, developer, status, version, ai_usage_state, description, keywords, recommendation, github_url, avatar, icon, banner, stars, language, last_update, github_is_fork, github_parent_url, github_source_url, extra, organization_id, developer_user_id)
    values (
      ${slug},
      ${safeInput.name},
      ${categoryId},
      ${safeInput.developer ?? ""},
      ${safeInput.status ?? ""},
      ${safeInput.version ?? ""},
      ${safeInput.ai_usage_state ?? "unknown"},
      ${safeInput.description ?? ""},
      ${safeInput.keywords ?? []},
      ${safeInput.recommendation ?? []},
      ${safeInput.github_url ?? ""},
      ${safeInput.avatar ?? ""},
      ${safeInput.icon ?? ""},
      ${safeInput.banner ?? ""},
      ${safeInput.stars ?? 0},
      ${safeInput.language ?? ""},
      ${safeInput.last_update ?? null}
      ,${safeInput.github_is_fork ?? false}
      ,${safeInput.github_parent_url ?? ""}
      ,${safeInput.github_source_url ?? ""}
      ,${safeInput.extra ?? {}}
      ,${safeInput.organization_id ?? null}
      ,${safeInput.developer_user_id ?? null}
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

const DEV_EXTRA_MEDIA_KEYS = [
  "filing_image",
  "filing_image_url",
  "registration_image",
  "registration_image_url",
  "license_image",
  "license_image_url",
] as const;

function normalizeDevEditableExtra(value: unknown): Record<string, string> {
  const raw = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const out: Record<string, string> = {};
  for (const key of DEV_EXTRA_MEDIA_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
    out[key] = normalizeInternalUploadUrl(raw[key]);
  }
  return out;
}

function mergeDefined<T extends Record<string, any>>(input: T, normalized: Record<string, any>): T {
  const out = { ...input } as Record<string, any>;
  for (const [key, value] of Object.entries(normalized)) {
    if (value !== undefined) out[key] = value;
  }
  return out as T;
}

function normalizeProjectForStorage<T extends Partial<ProjectRow>>(input: T): T {
  const merged = mergeDefined(input as Record<string, any>, normalizeProjectInput(input)) as Record<string, any>;
  if (Object.prototype.hasOwnProperty.call(input, "recommendation")) {
    merged.recommendation = recommendationToArray(merged.recommendation);
  }
  return merged as T;
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
    out.extra = normalizeDevEditableExtra(p.extra ?? n.extra);
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
  const safeInput = normalizeProjectForStorage(input);
  const hasOrg = input.organization_id !== undefined;
  const hasDev = input.developer_user_id !== undefined;
  const hasCategory = input.category_id !== undefined;
  const categoryId = hasCategory ? await resolveCategoryIdOrUncategorized(safeInput.category_id) : null;
  const [row] = await sql()<ProjectRow[]>`
    update projects
    set
      name = coalesce(${safeInput.name ?? null}, name),
      category_id = case when ${hasCategory} then ${categoryId} else projects.category_id end,
      developer = coalesce(${safeInput.developer ?? null}, developer),
      status = coalesce(${safeInput.status ?? null}, status),
      version = coalesce(${safeInput.version ?? null}, version),
      ai_usage_state = coalesce(${safeInput.ai_usage_state ?? null}, ai_usage_state),
      description = coalesce(${safeInput.description ?? null}, description),
      keywords = coalesce(${safeInput.keywords ?? null}, keywords),
      recommendation = coalesce(${safeInput.recommendation ?? null}, recommendation),
      github_url = coalesce(${safeInput.github_url ?? null}, github_url),
      avatar = coalesce(${safeInput.avatar ?? null}, avatar),
      icon = coalesce(${safeInput.icon ?? null}, icon),
      banner = coalesce(${safeInput.banner ?? null}, banner),
      stars = coalesce(${safeInput.stars ?? null}, stars),
      language = coalesce(${safeInput.language ?? null}, language),
      last_update = coalesce(${safeInput.last_update ?? null}, last_update),
      github_is_fork = coalesce(${safeInput.github_is_fork ?? null}, github_is_fork),
      github_parent_url = coalesce(${safeInput.github_parent_url ?? null}, github_parent_url),
      github_source_url = coalesce(${safeInput.github_source_url ?? null}, github_source_url),
      extra = coalesce(${safeInput.extra ?? null}, extra),
      organization_id = case when ${hasOrg} then ${safeInput.organization_id ?? null} else projects.organization_id end,
      developer_user_id = case when ${hasDev} then ${safeInput.developer_user_id ?? null} else projects.developer_user_id end,
      updated_at = now()
    where id = ${id}
    returning id, slug, name, category_id, developer, status, version, ai_usage_state, description, keywords, recommendation, github_url, avatar, icon, banner, stars, language, last_update, github_is_fork, github_parent_url, github_source_url, extra, organization_id, developer_user_id
  `;
  return row ?? null;
}

export async function updateProjectGithubMetadata(id: string, input: Partial<ProjectRow>) {
  const safeInput = normalizeProjectForStorage(input);
  const [row] = await sql()<ProjectRow[]>`
    update projects
    set
      status = coalesce(${safeInput.status ?? null}, status),
      version = coalesce(${safeInput.version ?? null}, version),
      stars = coalesce(${safeInput.stars ?? null}, stars),
      language = coalesce(${safeInput.language ?? null}, language),
      last_update = coalesce(${safeInput.last_update ?? null}, last_update),
      github_is_fork = coalesce(${safeInput.github_is_fork ?? null}, github_is_fork),
      github_parent_url = coalesce(${safeInput.github_parent_url ?? null}, github_parent_url),
      github_source_url = coalesce(${safeInput.github_source_url ?? null}, github_source_url),
      extra = coalesce(${safeInput.extra ?? null}, extra),
      github_synced_at = now(),
      github_sync_error = ''
    where id = ${id}
    returning id, slug, name, category_id, developer, status, version, ai_usage_state, description, keywords, recommendation, github_url, avatar, icon, banner, stars, language, last_update, github_is_fork, github_parent_url, github_source_url, extra, organization_id, developer_user_id, github_synced_at, github_sync_error
  `;
  return row ?? null;
}

export async function markProjectGithubSyncAttempt(id: string, error: string) {
  await sql()`
    update projects
    set github_synced_at = now(),
        github_sync_error = ${error.slice(0, 500)}
    where id = ${id}
  `;
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
