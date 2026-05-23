import { sql } from "../db/client";

export type TagGroup = "feature" | "state" | "release" | "community" | "custom";
export type TagColorVariant = "emerald" | "amber" | "sky" | "rose" | "indigo" | "purple" | "orange" | "slate" | "blue";

export interface TagDefinition {
  id: string;
  slug: string;
  label: string;
  group: TagGroup;
  color_variant: TagColorVariant;
  show_on_card: boolean;
  show_on_header: boolean;
  show_in_gallery: boolean;
  card_priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type TagDefinitionWithCount = TagDefinition & { project_count: number };

export type RegistryTagSummary = Pick<TagDefinition, "id" | "label" | "group" | "color_variant">;

export function matchTagsFromKeywordLabels(
  keywords: string[],
  tags: Array<{ id: string; label: string; slug: string }>,
): string[] {
  const matched = new Set<string>();
  for (const raw of keywords) {
    const kw = String(raw ?? "").trim().toLowerCase();
    if (!kw) continue;
    for (const tag of tags) {
      const label = String(tag.label ?? "").trim().toLowerCase();
      const slug = String(tag.slug ?? "").trim().toLowerCase();
      if (label === kw || slug === kw || label.includes(kw) || kw.includes(label)) {
        matched.add(tag.id);
      }
    }
  }
  return [...matched];
}

export function normalizeTagSlug(raw: string): string {
  const base = String(raw ?? "").trim().toLowerCase();
  let slug = base
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  if (!slug) {
    const hash = Buffer.from(base, "utf8").toString("hex").slice(0, 12);
    slug = `tag-${hash}`;
  }
  return slug;
}

export function isValidTagSlug(slug: string): boolean {
  return slug.length >= 1 && slug.length <= 80;
}

function mapRow(row: any): TagDefinition {
  return row as TagDefinition;
}

export async function listActiveTags(): Promise<TagDefinition[]> {
  const rows = await sql()<TagDefinition[]>`
    select * from tag_definitions
    where is_active = true and show_in_gallery = true
    order by card_priority desc, label asc
  `;
  return rows.map(mapRow);
}

export async function listAdminTags(params?: { q?: string; group?: string }) {
  const q = params?.q?.trim();
  const group = params?.group?.trim();
  const like = q ? `%${q}%` : null;

  const whereParts = [];
  if (group && ["feature", "state", "release", "community", "custom"].includes(group)) {
    whereParts.push(sql()`td."group" = ${group}`);
  }
  if (like) {
    whereParts.push(sql()`(td.label ilike ${like} or td.slug ilike ${like})`);
  }
  const where = whereParts.length ? sql().join(whereParts, sql()` and `) : sql()`true`;

  const rows = await sql()<Array<TagDefinition & { project_count: number }>>`
    select td.*, coalesce(pc.project_count, 0)::int as project_count
    from tag_definitions td
    left join lateral (
      select count(*)::int as project_count from project_tag_links ptl where ptl.tag_id = td.id
    ) pc on true
    where ${where}
    order by td.card_priority desc, td.label asc
  `;

  return {
    items: rows.map((row) => ({
      ...mapRow(row),
      project_count: row.project_count ?? 0,
    })) as TagDefinitionWithCount[],
  };
}

export async function getTagById(id: string) {
  const [row] = await sql()<TagDefinition[]>`select * from tag_definitions where id = ${id}`;
  return row ? mapRow(row) : null;
}

export async function createTag(input: Partial<TagDefinition>) {
  const slug = normalizeTagSlug(input.slug ?? input.label ?? "tag");
  if (!isValidTagSlug(slug)) throw new Error("invalid slug");
  const [row] = await sql()<TagDefinition[]>`
    insert into tag_definitions (
      slug, label, "group", color_variant,
      show_on_card, show_on_header, show_in_gallery, card_priority, is_active
    ) values (
      ${slug},
      ${input.label ?? slug},
      ${input.group ?? "custom"},
      ${input.color_variant ?? "slate"},
      false,
      false,
      ${input.show_in_gallery ?? true},
      ${input.card_priority ?? 0},
      ${input.is_active ?? true}
    )
    returning *
  `;
  return mapRow(row);
}

export async function updateTag(id: string, input: Partial<TagDefinition>) {
  const existing = await getTagById(id);
  if (!existing) return null;
  const slug = input.slug !== undefined ? normalizeTagSlug(input.slug) : existing.slug;
  if (!isValidTagSlug(slug)) throw new Error("invalid slug");
  const [row] = await sql()<TagDefinition[]>`
    update tag_definitions set
      slug = ${slug},
      label = ${input.label ?? existing.label},
      "group" = ${input.group ?? existing.group},
      color_variant = ${input.color_variant ?? existing.color_variant},
      show_on_card = false,
      show_on_header = false,
      show_in_gallery = ${input.show_in_gallery ?? existing.show_in_gallery},
      card_priority = ${input.card_priority ?? existing.card_priority},
      is_active = ${input.is_active ?? existing.is_active},
      updated_at = now()
    where id = ${id}
    returning *
  `;
  return mapRow(row);
}

export async function deleteTag(id: string) {
  const rows = await sql()`delete from tag_definitions where id = ${id} returning id`;
  return rows.length > 0;
}

export async function getProjectTagIds(projectId: string): Promise<string[]> {
  const rows = await sql()<Array<{ tag_id: string }>>`
    select tag_id from project_tag_links where project_id = ${projectId}
  `;
  return rows.map((r) => r.tag_id);
}

export async function getTagsForProject(projectId: string): Promise<TagDefinition[]> {
  const rows = await sql()<TagDefinition[]>`
    select td.*
    from project_tag_links ptl
    join tag_definitions td on td.id = ptl.tag_id
    where ptl.project_id = ${projectId} and td.is_active = true
    order by td.card_priority desc, td.label asc
  `;
  return rows.map(mapRow);
}

export async function setProjectTags(projectId: string, tagIds: string[]) {
  const unique = [...new Set(tagIds.filter(Boolean))];
  await sql()`delete from project_tag_links where project_id = ${projectId}`;
  for (const tagId of unique) {
    await sql()`
      insert into project_tag_links (project_id, tag_id)
      values (${projectId}, ${tagId})
      on conflict do nothing
    `;
  }
  return getTagsForProject(projectId);
}

export async function attachRegistryTagsToCatalog<
  T extends { id?: string },
  C extends { projects: T[]; id?: string; name?: string; description?: string },
>(categories: C[]): Promise<C[]> {
  const ids = categories.flatMap((c) => c.projects.map((p) => p.id).filter(Boolean)) as string[];
  const tagMap = await getTagsForProjects(ids);
  return categories.map((c) => ({
    ...c,
    projects: c.projects.map((p) => ({
      ...p,
      registry_tags: p.id ? tagMap.get(p.id) ?? [] : [],
    })),
  })) as C[];
}

export async function getTagsForProjects(projectIds: string[]): Promise<Map<string, TagDefinition[]>> {
  const map = new Map<string, TagDefinition[]>();
  if (projectIds.length === 0) return map;
  const rows = await sql()<Array<TagDefinition & { project_id: string }>>`
    select ptl.project_id, td.*
    from project_tag_links ptl
    join tag_definitions td on td.id = ptl.tag_id
    where ptl.project_id = any(${projectIds}) and td.is_active = true
    order by td.card_priority desc, td.label asc
  `;
  for (const row of rows) {
    const { project_id, ...tag } = row;
    const list = map.get(project_id) ?? [];
    list.push(mapRow(tag));
    map.set(project_id, list);
  }
  return map;
}

export async function seedTagsFromProjectsIfEmpty() {
  const [{ count }] = await sql()<Array<{ count: string }>>`select count(*)::text as count from tag_definitions`;
  if (Number(count) > 0) return { seeded: false };
  const { normalizeProjectTags } = await import("../domain/projectTags");
  const projects = await sql()<Array<{ id: string; keywords: string[]; extra: any }>>`
    select id, keywords, extra from projects
  `;
  let linked = 0;
  for (const p of projects) {
    const normalized = normalizeProjectTags(p);
    const stateTags = Array.isArray(p.extra?.feishu?.project_state_tags) ? p.extra.feishu.project_state_tags : [];
    const keywords = Array.isArray(normalized.keywords) ? normalized.keywords : [];
    const labels = new Set<string>();
    for (const t of [...stateTags, ...keywords]) {
      const s = String(t).trim();
      if (s) labels.add(s);
    }
    const tagIds: string[] = [];
    for (const label of labels) {
      const group =
        label.includes("稳定") || label.includes("画饼") || label.includes("停更") || label.includes("活跃")
          ? ("state" as TagGroup)
          : ("feature" as TagGroup);
      const tag = await findOrCreateTagByLabel(label, group, {
        show_in_gallery: true,
        show_on_card: group === "state",
        card_priority: group === "state" ? 5 : 0,
      });
      if (tag) tagIds.push(tag.id);
    }
    if (tagIds.length) {
      await setProjectTags(p.id, tagIds);
      linked++;
    }
  }
  return { seeded: true, linked };
}

export async function findOrCreateTagByLabel(label: string, group: TagGroup, opts?: Partial<TagDefinition>) {
  const trimmed = label.trim();
  if (!trimmed) return null;
  const slug = normalizeTagSlug(trimmed);
  const [existing] = await sql()<TagDefinition[]>`
    select * from tag_definitions where slug = ${slug} or label = ${trimmed} limit 1
  `;
  if (existing) return mapRow(existing);
  return createTag({
    slug,
    label: trimmed,
    group,
    show_in_gallery: true,
    show_on_card: opts?.show_on_card ?? false,
    show_on_header: opts?.show_on_header ?? false,
    card_priority: opts?.card_priority ?? 0,
    color_variant: opts?.color_variant ?? "slate",
  });
}
