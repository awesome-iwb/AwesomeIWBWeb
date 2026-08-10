import { sql } from "../db/client";
import { syncMediaReferencesForEntity } from "./media";
import {
  buildGalleryVideoEmbedUrl,
  buildGalleryVideoPageUrl,
  MAX_GALLERY_ITEMS_PER_PROJECT,
  type GalleryItemInput,
  type GalleryVideoProvider,
} from "../domain/projectGalleryItem";

const dbEnabled = Boolean(process.env.DATABASE_URL);

/** 媒体引用实体类型。必须与 projects 的 "project" 区分，否则 syncMediaReferencesForEntity
 *  的 DELETE-then-INSERT 会误删项目的图标 / Banner 引用。 */
export const GALLERY_MEDIA_ENTITY_TYPE = "project_gallery_item";

export type GalleryItem = {
  id: string;
  project_id: string;
  media_type: "image" | "text" | "video_embed";
  image_url: string;
  title: string;
  caption: string;
  link_url: string;
  linked_project_id: string | null;
  linked_project_slug: string | null;
  linked_project_name: string | null;
  video_provider: GalleryVideoProvider | "";
  video_id: string;
  video_embed_url: string;
  video_page_url: string;
  sort_index: number;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
};

type RawGalleryRow = {
  id: string;
  project_id: string;
  media_type: "image" | "text" | "video_embed";
  image_url: string;
  title: string;
  caption: string;
  link_url: string;
  linked_project_id: string | null;
  linked_project_slug: string | null;
  linked_project_name: string | null;
  video_provider: GalleryVideoProvider | "";
  video_id: string;
  sort_index: number;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
};

function affectedRowCount(result: unknown): number {
  const value = result as { count?: number; rowCount?: number } | null;
  const count = Number(value?.count ?? value?.rowCount ?? (Array.isArray(result) ? result.length : 0));
  return Number.isFinite(count) ? count : 0;
}

function toGalleryItem(row: RawGalleryRow): GalleryItem {
  const videoProvider = (row.video_provider ?? "") as GalleryVideoProvider | "";
  const videoId = row.video_id ?? "";
  return {
    id: row.id,
    project_id: row.project_id,
    media_type: row.media_type,
    image_url: row.image_url ?? "",
    title: row.title ?? "",
    caption: row.caption ?? "",
    link_url: row.link_url ?? "",
    linked_project_id: row.linked_project_id ?? null,
    linked_project_slug: row.linked_project_slug ?? null,
    linked_project_name: row.linked_project_name ?? null,
    video_provider: videoProvider,
    video_id: videoId,
    video_embed_url: buildGalleryVideoEmbedUrl(videoProvider, videoId),
    video_page_url: buildGalleryVideoPageUrl(videoProvider, videoId),
    sort_index: row.sort_index ?? 0,
    is_enabled: Boolean(row.is_enabled),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** 仅 image_url 才算媒体引用，text / video_embed 没有站内媒体文件。 */
export function buildGalleryMediaFields(item: {
  image_url: string;
}): Array<{ url: string; fieldPath: string }> {
  if (!item.image_url) return [];
  return [{ url: item.image_url, fieldPath: "image_url" }];
}

/** 前台只读：仅启用项，按 sort_index 升序。 */
export async function listPublicGalleryItems(projectId: string): Promise<GalleryItem[]> {
  if (!dbEnabled) return [];
  const rows = await sql()<RawGalleryRow[]>`
    select g.*,
           lp.slug as linked_project_slug,
           lp.name as linked_project_name
    from project_gallery_items g
    left join projects lp on lp.id = g.linked_project_id
    where g.project_id = ${projectId} and g.is_enabled
    order by g.sort_index asc, g.created_at asc
  `;
  return rows.map(toGalleryItem);
}

/** 管理端：含未启用项，按 sort_index 升序。 */
export async function listGalleryItems(projectId: string): Promise<GalleryItem[]> {
  if (!dbEnabled) return [];
  const rows = await sql()<RawGalleryRow[]>`
    select g.*,
           lp.slug as linked_project_slug,
           lp.name as linked_project_name
    from project_gallery_items g
    left join projects lp on lp.id = g.linked_project_id
    where g.project_id = ${projectId}
    order by g.sort_index asc, g.created_at asc
  `;
  return rows.map(toGalleryItem);
}

export async function getGalleryItemById(id: string): Promise<GalleryItem | null> {
  if (!dbEnabled) return null;
  const rows = await sql()<RawGalleryRow[]>`
    select g.*,
           lp.slug as linked_project_slug,
           lp.name as linked_project_name
    from project_gallery_items g
    left join projects lp on lp.id = g.linked_project_id
    where g.id = ${id}
    limit 1
  `;
  return rows[0] ? toGalleryItem(rows[0]) : null;
}

export async function createGalleryItem(params: {
  projectId: string;
  input: GalleryItemInput;
  actor: string;
}): Promise<GalleryItem | null> {
  if (!dbEnabled) return null;
  const { projectId, input, actor } = params;

  const counts = await sql()<Array<{ count: string }>>`
    select count(*)::text as count from project_gallery_items where project_id = ${projectId}
  `;
  if (Number(counts[0]?.count ?? 0) >= MAX_GALLERY_ITEMS_PER_PROJECT) {
    const err = new Error("GALLERY_FULL");
    (err as Error & { code?: string }).code = "GALLERY_FULL";
    throw err;
  }

  let sortIndex = input.sort_index;
  if (!sortIndex) {
    const maxRows = await sql()<Array<{ m: number }>>`
      select coalesce(max(sort_index), 0)::int as m from project_gallery_items where project_id = ${projectId}
    `;
    sortIndex = (maxRows[0]?.m ?? 0) + 1;
  }

  const inserted = await sql()<RawGalleryRow[]>`
    insert into project_gallery_items (
      project_id, media_type, image_url, title, caption, link_url, linked_project_id,
      video_provider, video_id, sort_index, is_enabled, created_by, updated_by
    ) values (
      ${projectId}, ${input.media_type}, ${input.image_url}, ${input.title}, ${input.caption},
      ${input.link_url}, ${input.linked_project_id}, ${input.video_provider}, ${input.video_id},
      ${sortIndex}, ${input.is_enabled}, ${actor}, ${actor}
    )
    returning *
  `;
  const row = inserted[0];
  if (!row) return null;

  if (input.image_url) {
    await syncMediaReferencesForEntity({
      entityType: GALLERY_MEDIA_ENTITY_TYPE,
      entityId: row.id,
      fields: buildGalleryMediaFields(row),
    });
  }
  return getGalleryItemById(row.id);
}

export async function updateGalleryItem(params: {
  id: string;
  patch: Partial<GalleryItemInput>;
  actor: string;
  projectId?: string;
}): Promise<GalleryItem | null> {
  if (!dbEnabled) return null;
  const { id, patch, actor, projectId } = params;
  const existing = await getGalleryItemById(id);
  if (!existing) return null;
  if (projectId && existing.project_id !== projectId) return null;

  const next = { ...existing, ...patch } as GalleryItem;
  await sql()`
    update project_gallery_items set
      media_type = ${next.media_type},
      image_url = ${next.image_url},
      title = ${next.title},
      caption = ${next.caption},
      link_url = ${next.link_url},
      linked_project_id = ${next.linked_project_id},
      video_provider = ${next.video_provider},
      video_id = ${next.video_id},
      sort_index = ${next.sort_index},
      is_enabled = ${next.is_enabled},
      updated_by = ${actor},
      updated_at = now()
    where id = ${id}
  `;

  await syncMediaReferencesForEntity({
    entityType: GALLERY_MEDIA_ENTITY_TYPE,
    entityId: id,
    fields: buildGalleryMediaFields(next),
  });
  return getGalleryItemById(id);
}

export async function deleteGalleryItem(params: {
  id: string;
  projectId?: string;
}): Promise<boolean> {
  if (!dbEnabled) return false;
  const { id, projectId } = params;
  if (projectId) {
    const existing = await getGalleryItemById(id);
    if (!existing || existing.project_id !== projectId) return false;
  }
  return sql().begin(async (tx) => {
    await tx`
      delete from media_references
      where entity_type = ${GALLERY_MEDIA_ENTITY_TYPE} and entity_id = ${id}
    `;
    const result = await tx`delete from project_gallery_items where id = ${id}`;
    return affectedRowCount(result) > 0;
  }) as Promise<boolean>;
}

/** 排序：project_id 守卫，拒绝把其它项目的条目排进来。 */
export async function reorderGalleryItems(params: {
  projectId: string;
  orders: Array<{ id: string; sort_index: number }>;
  actor: string;
}): Promise<void> {
  if (!dbEnabled) return;
  const { projectId, orders, actor } = params;
  const ids = orders.map((o) => o.id);
  if (ids.length === 0) return;
  const rows = await sql()<Array<{ id: string }>>`
    select id from project_gallery_items where project_id = ${projectId} and id = any(${ids}::uuid[])
  `;
  const okIds = new Set(rows.map((r) => r.id));
  await sql().begin(async (tx) => {
    for (const o of orders) {
      if (!okIds.has(o.id)) continue;
      await tx`
        update project_gallery_items
        set sort_index = ${o.sort_index}, updated_by = ${actor}, updated_at = now()
        where id = ${o.id}
      `;
    }
  });
}

/** 删除项目时，清掉其所有详情图条目在 media_references 里的引用。 */
export async function clearGalleryMediaReferencesForProject(projectId: string): Promise<void> {
  if (!dbEnabled) return;
  await sql()`
    delete from media_references
    where entity_type = ${GALLERY_MEDIA_ENTITY_TYPE}
      and entity_id in (select id from project_gallery_items where project_id = ${projectId})
  `;
}

/** 运维后台：跨项目列表（含未启用项）。 */
export async function listGalleryItemsForAdmin(filters?: {
  projectId?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: GalleryItem[]; page: number; pageSize: number; total: number }> {
  if (!dbEnabled) return { items: [], page: 1, pageSize: 50, total: 0 };
  const page = Number.isFinite(filters?.page) ? Math.max(1, Math.floor(filters!.page!)) : 1;
  const pageSize = Number.isFinite(filters?.pageSize)
    ? Math.min(100, Math.max(1, Math.floor(filters!.pageSize!)))
    : 50;
  const offset = (page - 1) * pageSize;

  const db = sql();
  const projectFilter = filters?.projectId ? db`and g.project_id = ${filters.projectId}` : db``;

  const rows = await db<RawGalleryRow[]>`
    select g.*,
           lp.slug as linked_project_slug,
           lp.name as linked_project_name
    from project_gallery_items g
    left join projects lp on lp.id = g.linked_project_id
    where true ${projectFilter}
    order by lp.name asc, g.sort_index asc, g.created_at asc
    limit ${pageSize} offset ${offset}
  `;
  const totals = await db<Array<{ count: string }>>`
    select count(*)::text as count from project_gallery_items g where true ${projectFilter}
  `;
  return {
    items: rows.map(toGalleryItem),
    page,
    pageSize,
    total: Number(totals[0]?.count ?? 0),
  };
}

export type GalleryTrackEvent = { itemId: string; type: "impression" | "click" };

/** 批量上报：聚合后 upsert 到每日汇总表。只统计真实存在的条目。 */
export async function recordGalleryEvents(events: GalleryTrackEvent[]): Promise<void> {
  if (!dbEnabled) return;
  if (events.length === 0) return;

  const counts = new Map<string, { impressions: number; clicks: number }>();
  for (const e of events) {
    const cur = counts.get(e.itemId) ?? { impressions: 0, clicks: 0 };
    if (e.type === "impression") cur.impressions += 1;
    else cur.clicks += 1;
    counts.set(e.itemId, cur);
  }

  const itemIds = [...counts.keys()];
  const rows = await sql()<Array<{ id: string; project_id: string }>>`
    select id, project_id from project_gallery_items where id = any(${itemIds}::uuid[])
  `;
  const projectOf = new Map(rows.map((r) => [r.id, r.project_id]));

  await sql().begin(async (tx) => {
    for (const [itemId, c] of counts) {
      const projectId = projectOf.get(itemId);
      if (!projectId) continue;
      await tx`
        insert into project_gallery_daily_stats (item_id, project_id, stat_date, impressions, clicks)
        values (${itemId}, ${projectId}, current_date, ${c.impressions}, ${c.clicks})
        on conflict (item_id, stat_date) do update set
          impressions = project_gallery_daily_stats.impressions + EXCLUDED.impressions,
          clicks = project_gallery_daily_stats.clicks + EXCLUDED.clicks,
          updated_at = now()
      `;
    }
  });
}

export type GalleryStatsRow = {
  item_id: string;
  project_id: string;
  project_name: string;
  project_slug: string;
  media_type: "image" | "text" | "video_embed";
  title: string;
  impressions: number;
  clicks: number;
};

/** 汇总看板：按 (项目白名单 / 日期区间) 聚合各条目曝光与点击。 */
export async function getGalleryStats(filters?: {
  projectIds?: string[];
  from?: string;
  to?: string;
  limit?: number;
}): Promise<GalleryStatsRow[]> {
  if (!dbEnabled) return [];
  const db = sql();
  const projectFilter =
    filters?.projectIds && filters.projectIds.length
      ? db`and g.project_id = any(${filters.projectIds}::uuid[])`
      : db``;
  const fromFilter = filters?.from ? db`and s.stat_date >= ${filters.from}::date` : db``;
  const toFilter = filters?.to ? db`and s.stat_date <= ${filters.to}::date` : db``;
  const limit = Number.isFinite(filters?.limit) ? Math.min(500, Math.max(1, Math.floor(filters!.limit!))) : 200;

  const rows = await db<Array<{
    item_id: string;
    project_id: string;
    project_name: string;
    project_slug: string;
    media_type: "image" | "text" | "video_embed";
    title: string;
    impressions: string;
    clicks: string;
  }>>`
    select g.id as item_id, g.project_id,
           p.name as project_name, p.slug as project_slug,
           g.media_type, g.title,
           coalesce(sum(s.impressions), 0)::text as impressions,
           coalesce(sum(s.clicks), 0)::text as clicks
    from project_gallery_items g
    left join projects p on p.id = g.project_id
    left join project_gallery_daily_stats s on s.item_id = g.id
    where true ${projectFilter} ${fromFilter} ${toFilter}
    group by g.id, g.project_id, p.name, p.slug, g.media_type, g.title
    order by (coalesce(sum(s.impressions), 0) + coalesce(sum(s.clicks), 0)) desc
    limit ${limit}
  `;
  return rows.map((r) => ({
    item_id: r.item_id,
    project_id: r.project_id,
    project_name: r.project_name,
    project_slug: r.project_slug,
    media_type: r.media_type,
    title: r.title,
    impressions: Number(r.impressions),
    clicks: Number(r.clicks),
  }));
}
