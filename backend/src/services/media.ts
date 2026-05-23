import { sql } from "../db/client";

const dbEnabled = Boolean(process.env.DATABASE_URL);

export type MediaAsset = {
  id: string;
  sha256: string;
  storage_key: string;
  url: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  source: string;
  uploader_id: string | null;
  status: string;
  created_at: string;
  deleted_at: string | null;
  last_referenced_at: string | null;
};

export type MediaAssetListItem = MediaAsset & {
  ref_count: number;
  tags: string[];
};

export type MediaReference = {
  media_id: string;
  entity_type: string;
  entity_id: string;
  field_path: string;
  ref_type: string;
  created_at: string;
};

async function touchMediaLastReferenced(mediaId: string): Promise<void> {
  if (!dbEnabled) return;
  await sql()`update media_assets set last_referenced_at = now() where id = ${mediaId}`;
}

export async function findActiveMediaBySha256(sha256: string): Promise<MediaAsset | null> {
  if (!dbEnabled) return null;
  const [row] = await sql()<MediaAsset[]>`
    select id, sha256, storage_key, url, mime, size, width, height, source, uploader_id, status, created_at, deleted_at, last_referenced_at
    from media_assets
    where sha256 = ${sha256} and status = 'active'
    order by created_at asc
    limit 1
  `;
  return row ?? null;
}

export async function getMediaAssetByStorageKey(storageKey: string): Promise<MediaAsset | null> {
  if (!dbEnabled) return null;
  const [row] = await sql()<MediaAsset[]>`
    select id, sha256, storage_key, url, mime, size, width, height, source, uploader_id, status, created_at, deleted_at, last_referenced_at
    from media_assets
    where storage_key = ${storageKey}
    order by case when status = 'active' then 0 else 1 end, created_at desc
    limit 1
  `;
  return row ?? null;
}

export async function getMediaRefCount(mediaId: string): Promise<number> {
  if (!dbEnabled) return 0;
  const [{ count }] = await sql()<Array<{ count: string }>>`
    select count(*)::text as count from media_references where media_id = ${mediaId}
  `;
  return Number(count) || 0;
}

export async function createOrGetMediaAssetFromUpload(input: {
  sha256: string;
  storageKey: string;
  url: string;
  mime: string;
  size: number;
  width?: number | null;
  height?: number | null;
  source?: string;
  uploaderId?: string | null;
}): Promise<MediaAsset | null> {
  if (!dbEnabled) return null;
  const [row] = await sql()<MediaAsset[]>`
    insert into media_assets (sha256, storage_key, url, mime, size, width, height, source, uploader_id, status)
    values (${input.sha256}, ${input.storageKey}, ${input.url}, ${input.mime}, ${input.size}, ${input.width ?? null}, ${input.height ?? null}, ${input.source ?? "upload"}, ${input.uploaderId ?? null}, 'active')
    on conflict (url) do update set
      sha256 = excluded.sha256,
      storage_key = excluded.storage_key,
      mime = excluded.mime,
      size = excluded.size,
      width = coalesce(excluded.width, media_assets.width),
      height = coalesce(excluded.height, media_assets.height),
      source = excluded.source,
      uploader_id = coalesce(media_assets.uploader_id, excluded.uploader_id),
      status = 'active',
      deleted_at = null
    returning id, sha256, storage_key, url, mime, size, width, height, source, uploader_id, status, created_at, deleted_at, last_referenced_at
  `;
  return row ?? null;
}

export async function listMediaAssets(
  filters: {
    q?: string;
    status?: string;
    mime?: string;
    source?: string;
    tag?: string;
  },
  pagination: { page?: number; pageSize?: number },
) {
  if (!dbEnabled) return { items: [] as MediaAssetListItem[], page: 1, pageSize: 50, total: 0 };
  const page = Math.max(1, pagination.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, pagination.pageSize ?? 50));
  const offset = (page - 1) * pageSize;

  const whereParts = [];
  const q = filters.q?.trim();
  if (q) whereParts.push(sql()`(m.url ilike ${"%" + q + "%"} or m.sha256 ilike ${"%" + q + "%"} or m.storage_key ilike ${"%" + q + "%"})`);
  if (filters.status) whereParts.push(sql()`m.status = ${filters.status}`);
  if (filters.mime) whereParts.push(sql()`m.mime = ${filters.mime}`);
  if (filters.source) whereParts.push(sql()`m.source = ${filters.source}`);
  if (filters.tag) {
    whereParts.push(sql()`m.id in (select media_id from media_tags where tag = ${filters.tag})`);
  }
  const where = whereParts.length ? sql().join(whereParts, sql()` and `) : sql()`true`;

  const rows = await sql()<
    Array<
      MediaAsset & {
        ref_count: number;
        tags: string[] | null;
      }
    >
  >`
    select
      m.id, m.sha256, m.storage_key, m.url, m.mime, m.size, m.width, m.height, m.source, m.uploader_id, m.status, m.created_at, m.deleted_at, m.last_referenced_at,
      coalesce(rc.ref_count, 0)::int as ref_count,
      coalesce(tg.tags, '{}'::text[]) as tags
    from media_assets m
    left join lateral (
      select count(*)::int as ref_count from media_references r where r.media_id = m.id
    ) rc on true
    left join lateral (
      select array_agg(tag order by tag) as tags from media_tags mt where mt.media_id = m.id
    ) tg on true
    where ${where}
    order by m.created_at desc
    limit ${pageSize} offset ${offset}
  `;
  const [{ count }] = await sql()<Array<{ count: string }>>`
    select count(*)::text as count from media_assets m where ${where}
  `;

  const items: MediaAssetListItem[] = rows.map((row) => ({
    id: row.id,
    sha256: row.sha256,
    storage_key: row.storage_key,
    url: row.url,
    mime: row.mime,
    size: row.size,
    width: row.width,
    height: row.height,
    source: row.source,
    uploader_id: row.uploader_id,
    status: row.status,
    created_at: row.created_at,
    deleted_at: row.deleted_at,
    last_referenced_at: row.last_referenced_at,
    ref_count: row.ref_count ?? 0,
    tags: Array.isArray(row.tags) ? row.tags : [],
  }));

  return { items, page, pageSize, total: Number(count) };
}

export async function getMediaReferences(mediaId: string): Promise<MediaReference[]> {
  if (!dbEnabled) return [];
  return sql()<MediaReference[]>`
    select media_id, entity_type, entity_id, field_path, ref_type, created_at
    from media_references
    where media_id = ${mediaId}
    order by created_at desc
  `;
}

export async function upsertMediaReference(input: {
  mediaId: string;
  entityType: string;
  entityId: string;
  fieldPath: string;
  refType?: string;
}): Promise<void> {
  if (!dbEnabled) return;
  await sql()`
    insert into media_references (media_id, entity_type, entity_id, field_path, ref_type)
    values (${input.mediaId}, ${input.entityType}, ${input.entityId}, ${input.fieldPath}, ${input.refType ?? "usage"})
    on conflict do nothing
  `;
  await touchMediaLastReferenced(input.mediaId);
}

export async function upsertMediaReferencesForEntity(params: {
  entityType: string;
  entityId: string;
  fields: Array<{ url: string; fieldPath: string }>;
  refType?: string;
}): Promise<number> {
  if (!dbEnabled) return 0;
  let count = 0;
  for (const field of params.fields) {
    if (!field.url) continue;
    const rows = await sql()<Array<{ id: string }>>`
      select id from media_assets where url = ${field.url} limit 1
    `;
    if (!rows.length) continue;
    await sql()`
      insert into media_references (media_id, entity_type, entity_id, field_path, ref_type)
      values (${rows[0].id}, ${params.entityType}, ${params.entityId}, ${field.fieldPath}, ${params.refType ?? "usage"})
      on conflict do nothing
    `;
    await touchMediaLastReferenced(rows[0].id);
    count++;
  }
  return count;
}

export async function softDeleteMedia(mediaId: string): Promise<MediaAsset | null> {
  if (!dbEnabled) return null;
  const [row] = await sql()<MediaAsset[]>`
    update media_assets
    set status = 'deleted', deleted_at = coalesce(deleted_at, now())
    where id = ${mediaId}
    returning id, sha256, storage_key, url, mime, size, width, height, source, uploader_id, status, created_at, deleted_at, last_referenced_at
  `;
  return row ?? null;
}

export async function restoreMedia(mediaId: string): Promise<MediaAsset | null> {
  if (!dbEnabled) return null;
  const [row] = await sql()<MediaAsset[]>`
    update media_assets
    set status = 'active', deleted_at = null
    where id = ${mediaId}
    returning id, sha256, storage_key, url, mime, size, width, height, source, uploader_id, status, created_at, deleted_at, last_referenced_at
  `;
  return row ?? null;
}

export async function getMediaTags(mediaId: string): Promise<string[]> {
  if (!dbEnabled) return [];
  const rows = await sql()<Array<{ tag: string }>>`
    select tag from media_tags where media_id = ${mediaId} order by tag
  `;
  return rows.map((r) => r.tag);
}

export async function setMediaTags(mediaId: string, tags: string[]): Promise<string[]> {
  if (!dbEnabled) return [];
  await sql()`delete from media_tags where media_id = ${mediaId}`;
  if (tags.length === 0) return [];
  for (const tag of tags) {
    await sql()`insert into media_tags (media_id, tag) values (${mediaId}, ${tag}) on conflict do nothing`;
  }
  return tags;
}

export async function batchTagMedia(mediaIds: string[], tagsToAdd: string[], tagsToRemove: string[]): Promise<void> {
  if (!dbEnabled) return;
  for (const mid of mediaIds) {
    for (const tag of tagsToRemove) {
      await sql()`delete from media_tags where media_id = ${mid} and tag = ${tag}`;
    }
    for (const tag of tagsToAdd) {
      await sql()`insert into media_tags (media_id, tag) values (${mid}, ${tag}) on conflict do nothing`;
    }
  }
}

export async function batchSoftDeleteMedia(mediaIds: string[]): Promise<number> {
  if (!dbEnabled) return 0;
  let count = 0;
  for (const mid of mediaIds) {
    const result = await sql()`update media_assets set status = 'deleted', deleted_at = coalesce(deleted_at, now()) where id = ${mid} and status = 'active'`;
    count += (result as any).count ?? (result as any).rowCount ?? 0;
  }
  return count;
}

export type PurgeCandidate = MediaAsset & { ref_count: number };

export async function listPurgeCandidates(minDeletedDays = 7): Promise<PurgeCandidate[]> {
  if (!dbEnabled) return [];
  return sql()<PurgeCandidate[]>`
    select
      m.id, m.sha256, m.storage_key, m.url, m.mime, m.size, m.width, m.height, m.source, m.uploader_id, m.status, m.created_at, m.deleted_at, m.last_referenced_at,
      coalesce(rc.ref_count, 0)::int as ref_count
    from media_assets m
    left join lateral (
      select count(*)::int as ref_count from media_references r where r.media_id = m.id
    ) rc on true
    where m.status = 'deleted'
      and m.deleted_at is not null
      and m.deleted_at < now() - (${minDeletedDays}::text || ' days')::interval
      and coalesce(rc.ref_count, 0) = 0
    order by m.deleted_at asc
  `;
}

export async function hardDeleteMediaRecord(mediaId: string): Promise<boolean> {
  if (!dbEnabled) return false;
  const result = await sql()`delete from media_assets where id = ${mediaId}`;
  const count = (result as any).count ?? (result as any).rowCount ?? 0;
  return count > 0;
}
