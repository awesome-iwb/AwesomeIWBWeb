import { sql } from "../db/client";

const dbEnabled = Boolean(process.env.DATABASE_URL);
const MAX_MEDIA_TAGS = 50;
const MAX_BATCH_MEDIA_IDS = 200;
const MAX_MEDIA_TAG_CHARS = 64;
const MEDIA_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeMediaId(value: unknown): string {
  const id = String(value ?? "").trim();
  return MEDIA_ID_PATTERN.test(id) ? id : "";
}

function normalizeMediaIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    const id = normalizeMediaId(item);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= MAX_BATCH_MEDIA_IDS) break;
  }
  return out;
}

function affectedRowCount(result: unknown): number {
  const value = result as { count?: number; rowCount?: number } | null;
  const count = Number(value?.count ?? value?.rowCount ?? (Array.isArray(result) ? result.length : 0));
  return Number.isFinite(count) ? count : 0;
}

function normalizeAliasPath(value: string): string {
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return "";
  }
  const raw = decoded.replace(/\\/g, "/").replace(/^\/+/, "").trim();
  if (!raw) return "";
  const parts = raw.split("/");
  if (parts.some((part) => !part || part === "." || part === ".." || /[\u0000-\u001F\u007F]/.test(part))) {
    return "";
  }
  return parts.join("/");
}

function aliasPathFromUrl(value: string): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  let pathname = raw;
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) pathname = new URL(raw).pathname;
  } catch {
    return "";
  }
  pathname = pathname.split(/[?#]/, 1)[0].replace(/\\/g, "/");
  const uploadsPrefix = "/api/uploads/";
  const prefixIndex = pathname.indexOf(uploadsPrefix);
  if (prefixIndex >= 0) pathname = pathname.slice(prefixIndex + uploadsPrefix.length);
  else if (pathname.startsWith("/")) return "";
  return normalizeAliasPath(pathname);
}

export function normalizeMediaTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    const tag = String(item ?? "")
      .replace(/[\u0000-\u001F\u007F]/g, "")
      .trim()
      .slice(0, MAX_MEDIA_TAG_CHARS);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= MAX_MEDIA_TAGS) break;
  }
  return out;
}

export type MediaBlobState = "pending" | "available" | "missing" | "corrupt" | "quarantined";
export type MediaIntegrityStatus = "unknown" | "verified" | "missing" | "corrupt";

export type MediaAsset = {
  id: string;
  blob_id: string | null;
  sha256: string;
  original_sha256: string | null;
  storage_key: string;
  url: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  source: string;
  namespace: string;
  uploader_id: string | null;
  status: string;
  integrity_status: MediaIntegrityStatus;
  verified_at: string | null;
  object_key: string;
  storage_layout: "legacy" | "v2";
  blob_state: MediaBlobState;
  created_at: string;
  deleted_at: string | null;
  last_referenced_at: string | null;
};

export type MediaBlob = {
  id: string;
  sha256: string;
  object_key: string;
  storage_layout: "legacy" | "v2";
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  state: MediaBlobState;
  verified_at: string | null;
  last_error: string | null;
};

export type MediaAssetListItem = MediaAsset & { ref_count: number; tags: string[] };

export type MediaReference = {
  media_id: string;
  entity_type: string;
  entity_id: string;
  field_path: string;
  ref_type: string;
  created_at: string;
};

export type MediaVariant = {
  id: string;
  blob_id: string;
  preset: string;
  transform_version: number;
  object_key: string;
  sha256: string;
  mime: string;
  size: number;
  width: number;
  height: number;
  state: string;
};

async function queryMediaAssetById(query: any, mediaId: string): Promise<MediaAsset | null> {
  const rows = (await query`
    select
      m.id, m.blob_id, coalesce(b.sha256, lower(m.sha256)) as sha256, m.original_sha256, m.storage_key, m.url, m.mime, m.size, m.width, m.height,
      m.source, m.namespace, m.uploader_id, m.status, m.integrity_status, m.verified_at,
      coalesce(b.object_key, m.storage_key) as object_key,
      coalesce(b.storage_layout, 'legacy') as storage_layout,
      coalesce(b.state, 'missing') as blob_state,
      m.created_at, m.deleted_at, m.last_referenced_at
    from media_assets m
    left join media_blobs b on b.id = m.blob_id
    where m.id = ${mediaId}
    limit 1
  `) as MediaAsset[];
  return rows[0] ?? null;
}

async function touchMediaLastReferenced(mediaId: string, query: any = sql()): Promise<void> {
  await query`update media_assets set last_referenced_at = now() where id = ${mediaId}`;
}

export async function findActiveMediaBySha256(sha256: string, namespace?: string): Promise<MediaAsset | null> {
  if (!dbEnabled) return null;
  const hash = String(sha256 ?? "").trim().toLowerCase();
  if (!hash) return null;
  const ns = namespace ?? null;
  const rows = await sql()<MediaAsset[]>`
    select
      m.id, m.blob_id, coalesce(b.sha256, lower(m.sha256)) as sha256, m.original_sha256, m.storage_key, m.url, m.mime, m.size, m.width, m.height,
      m.source, m.namespace, m.uploader_id, m.status, m.integrity_status, m.verified_at,
      coalesce(b.object_key, m.storage_key) as object_key,
      coalesce(b.storage_layout, 'legacy') as storage_layout,
      coalesce(b.state, 'missing') as blob_state,
      m.created_at, m.deleted_at, m.last_referenced_at
    from media_assets m
    left join media_blobs b on b.id = m.blob_id
    where lower(m.sha256) = ${hash} and m.status = 'active'
      and (${ns}::text is null or m.namespace = ${ns})
    order by m.created_at asc
    limit 1
  `;
  return rows[0] ?? null;
}

export async function getMediaAssetByStorageKey(storageKey: string): Promise<MediaAsset | null> {
  if (!dbEnabled) return null;
  const requested = String(storageKey ?? "").trim();
  if (!requested) return null;
  const alias = aliasPathFromUrl(requested);
  const rows = await sql()<MediaAsset[]>`
    select
      m.id, m.blob_id, coalesce(b.sha256, lower(m.sha256)) as sha256, m.original_sha256, m.storage_key, m.url, m.mime, m.size, m.width, m.height,
      m.source, m.namespace, m.uploader_id, m.status, m.integrity_status, m.verified_at,
      coalesce(b.object_key, m.storage_key) as object_key,
      coalesce(b.storage_layout, 'legacy') as storage_layout,
      coalesce(b.state, 'missing') as blob_state,
      m.created_at, m.deleted_at, m.last_referenced_at
    from media_assets m
    left join media_blobs b on b.id = m.blob_id
    left join media_aliases a on a.asset_id = m.id
    where m.storage_key = ${requested}
       or m.url = ${requested}
       or (${alias} <> '' and a.alias_path = ${alias})
    order by case when m.status = 'active' then 0 else 1 end, m.created_at desc
    limit 1
  `;
  return rows[0] ?? null;
}

export async function getMediaAssetById(mediaId: string): Promise<MediaAsset | null> {
  if (!dbEnabled) return null;
  const id = normalizeMediaId(mediaId);
  return id ? queryMediaAssetById(sql(), id) : null;
}

export async function getMediaRefCount(mediaId: string): Promise<number> {
  if (!dbEnabled) return 0;
  const id = normalizeMediaId(mediaId);
  if (!id) return 0;
  const rows = await sql()<Array<{ count: string }>>`
    select count(*)::text as count from media_references where media_id = ${id}
  `;
  return Number(rows[0]?.count ?? 0) || 0;
}

export async function reserveMediaAssetFromUpload(input: {
  sha256: string;
  originalSha256?: string | null;
  objectKey: string;
  storageKey: string;
  url: string;
  mime: string;
  size: number;
  width?: number | null;
  height?: number | null;
  source?: string;
  namespace: string;
  uploaderId?: string | null;
}): Promise<MediaAsset | null> {
  if (!dbEnabled) return null;
  const db = sql();
  const assetId = await db.begin(async (tx) => {
    await tx`
      insert into media_blobs (sha256, object_key, storage_layout, mime, size, width, height, state)
      values (
        ${input.sha256}, ${input.objectKey}, 'v2', ${input.mime}, ${input.size},
        ${input.width ?? null}, ${input.height ?? null}, 'pending'
      )
      on conflict (sha256) do nothing
    `;
    const blobs = (await tx`
      select id, sha256, object_key, storage_layout, mime, size, width, height, state, verified_at, last_error
      from media_blobs where sha256 = ${input.sha256} limit 1
    `) as MediaBlob[];
    const blob = blobs[0];
    if (!blob) throw new Error("MEDIA_BLOB_RESERVATION_FAILED");

    await tx`
      insert into media_assets (
        blob_id, sha256, original_sha256, storage_key, url, mime, size, width, height,
        source, namespace, uploader_id, status, integrity_status
      ) values (
        ${blob.id}, ${input.sha256}, ${input.originalSha256 ?? null}, ${input.storageKey}, ${input.url},
        ${input.mime}, ${input.size}, ${input.width ?? null}, ${input.height ?? null},
        ${input.source ?? "upload"}, ${input.namespace}, ${input.uploaderId ?? null}, 'pending', 'unknown'
      )
      on conflict (url) do update set
        blob_id = excluded.blob_id,
        sha256 = excluded.sha256,
        original_sha256 = coalesce(excluded.original_sha256, media_assets.original_sha256),
        storage_key = excluded.storage_key,
        mime = excluded.mime,
        size = excluded.size,
        width = excluded.width,
        height = excluded.height,
        source = excluded.source,
        namespace = excluded.namespace,
        uploader_id = coalesce(media_assets.uploader_id, excluded.uploader_id),
        status = case
          when media_assets.status = 'active' and media_assets.blob_id = excluded.blob_id then 'active'
          else 'pending'
        end,
        integrity_status = case
          when media_assets.status = 'active' and media_assets.blob_id = excluded.blob_id then media_assets.integrity_status
          else 'unknown'
        end,
        verified_at = case
          when media_assets.status = 'active' and media_assets.blob_id = excluded.blob_id then media_assets.verified_at
          else null
        end,
        deleted_at = null
    `;
    const assets = (await tx`select id from media_assets where url = ${input.url} limit 1`) as Array<{ id: string }>;
    const asset = assets[0];
    if (!asset) throw new Error("MEDIA_ASSET_RESERVATION_FAILED");
    await tx`
      insert into media_aliases (alias_path, asset_id) values (${input.storageKey}, ${asset.id})
      on conflict (alias_path) do update set asset_id = excluded.asset_id
    `;
    return asset.id;
  });
  return getMediaAssetById(assetId);
}

export async function activateReservedMedia(mediaId: string, blobId: string): Promise<MediaAsset | null> {
  if (!dbEnabled) return null;
  const id = normalizeMediaId(mediaId);
  const normalizedBlobId = normalizeMediaId(blobId);
  if (!id || !normalizedBlobId) return null;
  await sql().begin(async (tx) => {
    await tx`
      update media_blobs
      set state = 'available', verified_at = now(), last_error = null
      where id = ${normalizedBlobId}
    `;
    await tx`
      update media_assets
      set status = 'active', integrity_status = 'verified', verified_at = now(), deleted_at = null
      where id = ${id} and blob_id = ${normalizedBlobId}
    `;
  });
  return getMediaAssetById(id);
}

export async function failReservedMedia(
  mediaId: string | null,
  blobId: string | null,
  error: unknown,
): Promise<void> {
  if (!dbEnabled) return;
  const id = normalizeMediaId(mediaId);
  const normalizedBlobId = normalizeMediaId(blobId);
  if (!id && !normalizedBlobId) return;
  const message = String(error instanceof Error ? error.message : error).slice(0, 500);
  await sql().begin(async (tx) => {
    if (normalizedBlobId) {
      await tx`
        update media_blobs set state = 'corrupt', last_error = ${message}
        where id = ${normalizedBlobId} and state = 'pending'
      `;
    }
    if (id) {
      await tx`
        update media_assets set status = 'failed', integrity_status = 'corrupt'
        where id = ${id} and status = 'pending'
      `;
    }
  });
}

export async function markBlobAvailable(input: {
  blobId: string;
  objectKey: string;
  storageLayout?: "legacy" | "v2";
}): Promise<void> {
  if (!dbEnabled) return;
  const blobId = normalizeMediaId(input.blobId);
  if (!blobId) return;
  await sql()`
    update media_blobs
    set object_key = ${input.objectKey}, storage_layout = ${input.storageLayout ?? "v2"},
        state = 'available', verified_at = now(), last_error = null
    where id = ${blobId}
  `;
}

export async function markMediaIntegrity(input: {
  mediaId: string;
  integrity: MediaIntegrityStatus;
  error?: unknown;
}): Promise<void> {
  if (!dbEnabled) return;
  const id = normalizeMediaId(input.mediaId);
  if (!id) return;
  const message = input.error == null
    ? null
    : String(input.error instanceof Error ? input.error.message : input.error).slice(0, 500);
  const blobState: MediaBlobState | null = input.integrity === "verified"
    ? "available"
    : input.integrity === "missing" || input.integrity === "corrupt"
      ? input.integrity
      : null;

  await sql().begin(async (tx) => {
    await tx`
      update media_assets
      set integrity_status = ${input.integrity},
          verified_at = case when ${input.integrity} = 'verified' then now() else verified_at end,
          status = case
            when ${input.integrity} = 'missing' and status = 'active' then 'missing'
            when ${input.integrity} = 'verified' and status = 'missing' then 'active'
            else status
          end
      where id = ${id}
    `;
    if (blobState) {
      await tx`
        update media_blobs
        set state = ${blobState},
            verified_at = case when ${input.integrity} = 'verified' then now() else verified_at end,
            last_error = ${message}
        where id = (select blob_id from media_assets where id = ${id})
      `;
    }
  });
}

export async function createOrGetMediaAssetFromUpload(input: {
  sha256: string;
  originalSha256?: string | null;
  objectKey?: string;
  storageKey: string;
  url: string;
  mime: string;
  size: number;
  width?: number | null;
  height?: number | null;
  source?: string;
  namespace?: string;
  uploaderId?: string | null;
}): Promise<MediaAsset | null> {
  const reserved = await reserveMediaAssetFromUpload({
    ...input,
    objectKey: input.objectKey ?? input.storageKey,
    namespace: input.namespace ?? "content",
  });
  if (!reserved?.blob_id) return reserved;
  return activateReservedMedia(reserved.id, reserved.blob_id);
}

export async function listMediaAssets(
  filters: { q?: string; status?: string; mime?: string; source?: string; tag?: string; integrity?: string },
  pagination: { page?: number; pageSize?: number },
) {
  if (!dbEnabled) return { items: [] as MediaAssetListItem[], page: 1, pageSize: 50, total: 0 };
  const requestedPage = Number(pagination.page);
  const requestedPageSize = Number(pagination.pageSize);
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;
  const pageSize = Number.isFinite(requestedPageSize)
    ? Math.min(100, Math.max(1, Math.floor(requestedPageSize)))
    : 50;
  const offset = (page - 1) * pageSize;
  const q = filters.q?.trim();
  const db = sql();
  const qFilter = q
    ? db`and (m.url ilike ${"%" + q + "%"} or m.sha256 ilike ${"%" + q + "%"} or m.storage_key ilike ${"%" + q + "%"})`
    : db``;
  const statusFilter = filters.status ? db`and m.status = ${filters.status}` : db``;
  const mimeFilter = filters.mime ? db`and m.mime = ${filters.mime}` : db``;
  const sourceFilter = filters.source ? db`and m.source = ${filters.source}` : db``;
  const tagFilter = filters.tag ? db`and m.id in (select media_id from media_tags where tag = ${filters.tag})` : db``;
  const integrityFilter = filters.integrity ? db`and m.integrity_status = ${filters.integrity}` : db``;

  const rows = await sql()<Array<MediaAsset & { ref_count: number; tags: string[] | null }>>`
    select
      m.id, m.blob_id, coalesce(b.sha256, lower(m.sha256)) as sha256, m.original_sha256, m.storage_key, m.url, m.mime, m.size, m.width, m.height,
      m.source, m.namespace, m.uploader_id, m.status, m.integrity_status, m.verified_at,
      coalesce(b.object_key, m.storage_key) as object_key,
      coalesce(b.storage_layout, 'legacy') as storage_layout,
      coalesce(b.state, 'missing') as blob_state,
      m.created_at, m.deleted_at, m.last_referenced_at,
      coalesce(rc.ref_count, 0)::int as ref_count,
      coalesce(tg.tags, '{}'::text[]) as tags
    from media_assets m
    left join media_blobs b on b.id = m.blob_id
    left join lateral (select count(*)::int as ref_count from media_references r where r.media_id = m.id) rc on true
    left join lateral (select array_agg(tag order by tag) as tags from media_tags mt where mt.media_id = m.id) tg on true
    where true ${qFilter} ${statusFilter} ${mimeFilter} ${sourceFilter} ${tagFilter} ${integrityFilter}
    order by m.created_at desc
    limit ${pageSize} offset ${offset}
  `;
  const totals = await sql()<Array<{ count: string }>>`
    select count(*)::text as count from media_assets m
    where true ${qFilter} ${statusFilter} ${mimeFilter} ${sourceFilter} ${tagFilter} ${integrityFilter}
  `;
  return {
    items: rows.map((row) => ({ ...row, ref_count: row.ref_count ?? 0, tags: Array.isArray(row.tags) ? row.tags : [] })),
    page,
    pageSize,
    total: Number(totals[0]?.count ?? 0),
  };
}

export async function getMediaReferences(mediaId: string): Promise<MediaReference[]> {
  if (!dbEnabled) return [];
  const id = normalizeMediaId(mediaId);
  if (!id) return [];
  return sql()<MediaReference[]>`
    select media_id, entity_type, entity_id, field_path, ref_type, created_at
    from media_references where media_id = ${id} order by created_at desc
  `;
}

async function resolveAssetIdByUrl(query: any, url: string): Promise<string | null> {
  const requested = String(url ?? "").trim();
  if (!requested) return null;
  const alias = aliasPathFromUrl(requested);
  const rows = (await query`
    select m.id
    from media_assets m
    left join media_aliases a on a.asset_id = m.id
    where (m.url = ${requested} or (${alias} <> '' and a.alias_path = ${alias}))
      and m.status <> 'deleted'
    order by case when m.status = 'active' then 0 else 1 end, m.created_at asc
    limit 1
    for share of m
  `) as Array<{ id: string }>;
  return rows[0]?.id ?? null;
}

async function insertMediaReference(
  query: any,
  input: { mediaId: string; entityType: string; entityId: string; fieldPath: string; refType: string },
): Promise<void> {
  await query`
    insert into media_references (media_id, entity_type, entity_id, field_path, ref_type)
    values (${input.mediaId}, ${input.entityType}, ${input.entityId}, ${input.fieldPath}, ${input.refType})
    on conflict do nothing
  `;
  await touchMediaLastReferenced(input.mediaId, query);
}

export async function upsertMediaReference(input: {
  mediaId: string;
  entityType: string;
  entityId: string;
  fieldPath: string;
  refType?: string;
}): Promise<void> {
  if (!dbEnabled) return;
  const mediaId = normalizeMediaId(input.mediaId);
  if (!mediaId) return;
  await sql().begin(async (tx) => {
    const assets = (await tx`
      select id from media_assets where id = ${mediaId} and status <> 'deleted' for share
    `) as Array<{ id: string }>;
    if (!assets[0]) return;
    await insertMediaReference(tx, {
      mediaId,
      entityType: input.entityType,
      entityId: input.entityId,
      fieldPath: input.fieldPath,
      refType: input.refType ?? "usage",
    });
  });
}

export async function upsertMediaReferencesForEntity(params: {
  entityType: string;
  entityId: string;
  fields: Array<{ url: string; fieldPath: string }>;
  refType?: string;
}): Promise<number> {
  if (!dbEnabled) return 0;
  const refType = params.refType ?? "usage";
  return sql().begin(async (tx) => {
    let count = 0;
    for (const field of params.fields) {
      if (!field.url) continue;
      const mediaId = await resolveAssetIdByUrl(tx, field.url);
      if (!mediaId) continue;
      await insertMediaReference(tx, {
        mediaId,
        entityType: params.entityType,
        entityId: params.entityId,
        fieldPath: field.fieldPath,
        refType,
      });
      count++;
    }
    return count;
  });
}

export async function syncMediaReferencesForEntity(params: {
  entityType: string;
  entityId: string;
  fields: Array<{ url: string; fieldPath: string }>;
  refType?: string;
}): Promise<number> {
  if (!dbEnabled) return 0;
  const refType = params.refType ?? "usage";
  return sql().begin(async (tx) => {
    const resolved: Array<{ mediaId: string; fieldPath: string }> = [];
    for (const field of params.fields) {
      if (!field.url) continue;
      const mediaId = await resolveAssetIdByUrl(tx, field.url);
      if (mediaId) resolved.push({ mediaId, fieldPath: field.fieldPath });
    }
    await tx`
      delete from media_references
      where entity_type = ${params.entityType} and entity_id = ${params.entityId} and ref_type = ${refType}
    `;
    for (const field of resolved) {
      await insertMediaReference(tx, {
        mediaId: field.mediaId,
        entityType: params.entityType,
        entityId: params.entityId,
        fieldPath: field.fieldPath,
        refType,
      });
    }
    return resolved.length;
  });
}

export type SoftDeleteMediaResult = {
  asset: MediaAsset | null;
  blocked: boolean;
  refCount: number;
};

export async function softDeleteMediaSafely(mediaId: string): Promise<SoftDeleteMediaResult> {
  if (!dbEnabled) return { asset: null, blocked: false, refCount: 0 };
  const id = normalizeMediaId(mediaId);
  if (!id) return { asset: null, blocked: false, refCount: 0 };
  return sql().begin(async (tx) => {
    const locked = (await tx`
      select id from media_assets where id = ${id} for update
    `) as Array<{ id: string }>;
    if (!locked[0]) return { asset: null, blocked: false, refCount: 0 };
    const counts = (await tx`
      select count(*)::text as count from media_references where media_id = ${id}
    `) as Array<{ count: string }>;
    const refCount = Number(counts[0]?.count ?? 0) || 0;
    if (refCount > 0) {
      return { asset: await queryMediaAssetById(tx, id), blocked: true, refCount };
    }
    await tx`
      update media_assets
      set status = 'deleted', deleted_at = coalesce(deleted_at, now())
      where id = ${id} and status <> 'deleted'
    `;
    return { asset: await queryMediaAssetById(tx, id), blocked: false, refCount: 0 };
  });
}

export async function softDeleteMedia(mediaId: string): Promise<MediaAsset | null> {
  const result = await softDeleteMediaSafely(mediaId);
  return result.blocked ? null : result.asset;
}

export async function restoreMedia(mediaId: string): Promise<MediaAsset | null> {
  if (!dbEnabled) return null;
  const id = normalizeMediaId(mediaId);
  if (!id) return null;
  await sql()`update media_assets set status = 'active', deleted_at = null where id = ${id}`;
  return getMediaAssetById(id);
}

export async function getMediaVariant(
  blobId: string,
  preset: string,
  transformVersion = 1,
): Promise<MediaVariant | null> {
  if (!dbEnabled) return null;
  const id = normalizeMediaId(blobId);
  const safePreset = String(preset ?? "").trim();
  const version = Number.isInteger(transformVersion) && transformVersion > 0 ? transformVersion : 1;
  if (!id || !safePreset) return null;
  const rows = await sql()<MediaVariant[]>`
    select id, blob_id, preset, transform_version, object_key, sha256, mime, size, width, height, state
    from media_variants
    where blob_id = ${id} and preset = ${safePreset} and transform_version = ${version}
    limit 1
  `;
  return rows[0] ?? null;
}

export async function upsertMediaVariant(input: {
  blobId: string;
  preset: string;
  transformVersion?: number;
  objectKey: string;
  sha256: string;
  mime: string;
  size: number;
  width: number;
  height: number;
}): Promise<void> {
  if (!dbEnabled) return;
  const blobId = normalizeMediaId(input.blobId);
  const preset = String(input.preset ?? "").trim().slice(0, 128);
  const transformVersion = Number.isInteger(input.transformVersion) && Number(input.transformVersion) > 0
    ? Number(input.transformVersion)
    : 1;
  if (!blobId || !preset) return;
  await sql()`
    insert into media_variants (
      blob_id, preset, transform_version, object_key, sha256, mime, size, width, height, state, verified_at
    ) values (
      ${blobId}, ${preset}, ${transformVersion}, ${input.objectKey}, ${input.sha256},
      ${input.mime}, ${input.size}, ${input.width}, ${input.height}, 'available', now()
    )
    on conflict (blob_id, preset, transform_version) do update set
      object_key = excluded.object_key,
      sha256 = excluded.sha256,
      mime = excluded.mime,
      size = excluded.size,
      width = excluded.width,
      height = excluded.height,
      state = 'available',
      verified_at = now()
  `;
}

export async function getMediaTags(mediaId: string): Promise<string[]> {
  if (!dbEnabled) return [];
  const id = normalizeMediaId(mediaId);
  if (!id) return [];
  const rows = await sql()<Array<{ tag: string }>>`
    select tag from media_tags where media_id = ${id} order by tag
  `;
  return rows.map((row) => row.tag);
}

export async function listAllMediaTags(): Promise<string[]> {
  if (!dbEnabled) return [];
  const rows = await sql()<Array<{ tag: string }>>`
    select distinct tag from media_tags order by tag limit 1000
  `;
  return rows.map((row) => row.tag);
}

export async function setMediaTags(mediaId: string, tags: string[]): Promise<string[]> {
  if (!dbEnabled) return [];
  const id = normalizeMediaId(mediaId);
  if (!id) return [];
  const safeTags = normalizeMediaTags(tags);
  await sql().begin(async (tx) => {
    await tx`delete from media_tags where media_id = ${id}`;
    for (const tag of safeTags) {
      await tx`insert into media_tags (media_id, tag) values (${id}, ${tag}) on conflict do nothing`;
    }
  });
  return safeTags;
}

export async function batchTagMedia(mediaIds: string[], tagsToAdd: string[], tagsToRemove: string[]): Promise<void> {
  if (!dbEnabled) return;
  const ids = normalizeMediaIdList(mediaIds);
  const add = normalizeMediaTags(tagsToAdd);
  const remove = normalizeMediaTags(tagsToRemove);
  await sql().begin(async (tx) => {
    for (const id of ids) {
      for (const tag of remove) {
        await tx`delete from media_tags where media_id = ${id} and tag = ${tag}`;
      }
      for (const tag of add) {
        await tx`insert into media_tags (media_id, tag) values (${id}, ${tag}) on conflict do nothing`;
      }
    }
  });
}

export async function batchSoftDeleteMedia(mediaIds: string[]): Promise<number> {
  if (!dbEnabled) return 0;
  let count = 0;
  await sql().begin(async (tx) => {
    for (const id of normalizeMediaIdList(mediaIds)) {
      const locked = (await tx`
        select id from media_assets where id = ${id} and status <> 'deleted' for update
      `) as Array<{ id: string }>;
      if (!locked[0]) continue;
      const references = (await tx`
        select 1 from media_references where media_id = ${id} limit 1
      `) as Array<{ "?column?": number }>;
      if (references[0]) continue;
      const result = await tx`
        update media_assets
        set status = 'deleted', deleted_at = coalesce(deleted_at, now())
        where id = ${id} and status <> 'deleted'
      `;
      count += affectedRowCount(result);
    }
  });
  return count;
}

export type PurgeCandidate = MediaAsset & { ref_count: number; blob_asset_count: number };

export async function listPurgeCandidates(minDeletedDays = 7): Promise<PurgeCandidate[]> {
  if (!dbEnabled) return [];
  const days = Number.isFinite(minDeletedDays) ? Math.max(0, Math.floor(minDeletedDays)) : 7;
  return sql()<PurgeCandidate[]>`
    select
      m.id, m.blob_id, coalesce(b.sha256, lower(m.sha256)) as sha256, m.original_sha256, m.storage_key, m.url, m.mime, m.size, m.width, m.height,
      m.source, m.namespace, m.uploader_id, m.status, m.integrity_status, m.verified_at,
      coalesce(b.object_key, m.storage_key) as object_key,
      coalesce(b.storage_layout, 'legacy') as storage_layout,
      coalesce(b.state, 'missing') as blob_state,
      m.created_at, m.deleted_at, m.last_referenced_at,
      coalesce(rc.ref_count, 0)::int as ref_count,
      coalesce(bc.asset_count, case when m.blob_id is null then 1 else 0 end)::int as blob_asset_count
    from media_assets m
    left join media_blobs b on b.id = m.blob_id
    left join lateral (select count(*)::int as ref_count from media_references r where r.media_id = m.id) rc on true
    left join lateral (select count(*)::int as asset_count from media_assets x where x.blob_id = m.blob_id) bc on true
    where m.status = 'deleted'
      and m.deleted_at is not null
      and m.deleted_at < now() - (${days}::text || ' days')::interval
      and coalesce(rc.ref_count, 0) = 0
    order by m.deleted_at asc
  `;
}

export async function hardDeleteMediaRecord(mediaId: string): Promise<boolean> {
  if (!dbEnabled) return false;
  const id = normalizeMediaId(mediaId);
  if (!id) return false;
  const result = await sql()`
    delete from media_assets m
    where m.id = ${id}
      and m.status = 'deleted'
      and not exists (select 1 from media_references r where r.media_id = m.id)
  `;
  return affectedRowCount(result) > 0;
}

export async function deleteBlobRecordIfUnreferenced(blobId: string): Promise<boolean> {
  if (!dbEnabled) return false;
  const id = normalizeMediaId(blobId);
  if (!id) return false;
  const result = await sql()`
    delete from media_blobs b
    where b.id = ${id} and not exists (select 1 from media_assets m where m.blob_id = b.id)
  `;
  return affectedRowCount(result) > 0;
}
