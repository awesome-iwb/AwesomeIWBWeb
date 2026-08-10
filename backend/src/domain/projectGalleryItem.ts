import { normalizeInternalUploadUrl, normalizePublicWebsiteUrl } from "./urlSafety";

export const GALLERY_MEDIA_TYPES = ["image", "text", "video_embed"] as const;
export type GalleryMediaType = (typeof GALLERY_MEDIA_TYPES)[number];

export const GALLERY_VIDEO_PROVIDERS = ["bilibili", "tencent", "youku"] as const;
export type GalleryVideoProvider = (typeof GALLERY_VIDEO_PROVIDERS)[number];

export const MAX_GALLERY_ITEMS_PER_PROJECT = 24;
export const MAX_GALLERY_ORDER_ENTRIES = 200;
export const MAX_GALLERY_TRACK_EVENTS = 50;

const MAX_TITLE_CHARS = 120;
const MAX_CAPTION_CHARS = 600;
const MAX_SORT_INDEX = 9999;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type GalleryItemInput = {
  media_type: GalleryMediaType;
  image_url: string;
  title: string;
  caption: string;
  link_url: string;
  linked_project_id: string | null;
  video_provider: GalleryVideoProvider | "";
  video_id: string;
  sort_index: number;
  is_enabled: boolean;
};

export type NormalizeResult<T> = { ok: true; value: T } | { ok: false; error: string };

function ok<T>(value: T): NormalizeResult<T> {
  return { ok: true, value };
}

function fail<T>(error: string): NormalizeResult<T> {
  return { ok: false, error };
}

function boundedSingleLineText(value: unknown, maxChars: number): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || /[\x00-\x1f\x7f]/.test(text)) return "";
  return text.slice(0, maxChars);
}

function boundedMultilineText(value: unknown, maxChars: number): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text)) return "";
  return text.slice(0, maxChars);
}

function normalizeSortIndex(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(Math.trunc(n), 0), MAX_SORT_INDEX);
}

function normalizeUuid(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  return UUID_RE.test(raw) ? raw.toLowerCase() : null;
}

// ---------------------------------------------------------------------------
// 视频外链白名单
//
// 只存「厂商 + 视频 ID」，绝不存用户提供的 URL。播放地址一律由
// buildGalleryVideoEmbedUrl 用硬编码模板拼装，从根上消灭 iframe src 注入面。
// 主机名用全等比对（不是 endsWith），否则 evil-bilibili.com 会被放行。
// 短链（b23.tv 等）一律拒绝，因为无法在不发请求的情况下预验目标。
// ---------------------------------------------------------------------------

const VIDEO_ID_PATTERNS: Record<GalleryVideoProvider, RegExp> = {
  bilibili: /^BV[0-9A-Za-z]{10}$/,
  tencent: /^[0-9a-z]{6,32}$/i,
  youku: /^[0-9A-Za-z=_-]{8,64}$/,
};

const VIDEO_HOSTS: Record<string, GalleryVideoProvider> = {
  "www.bilibili.com": "bilibili",
  "bilibili.com": "bilibili",
  "m.bilibili.com": "bilibili",
  "v.qq.com": "tencent",
  "v.youku.com": "youku",
};

export type GalleryVideoRef = { provider: GalleryVideoProvider; id: string };

/**
 * 从用户粘贴的播放页 URL 解析出 (厂商, 视频 ID)。
 * 无法确定归属或 ID 格式不合法时返回 null。
 */
export function parseGalleryVideoRef(value: unknown): GalleryVideoRef | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const provider = VIDEO_HOSTS[url.hostname.toLowerCase()];
  if (!provider) return null;

  const parts = url.pathname.split("/").filter(Boolean);

  if (provider === "bilibili") {
    // https://www.bilibili.com/video/BV1xx411c7mD
    const idx = parts.indexOf("video");
    const candidate = idx >= 0 ? parts[idx + 1] : undefined;
    if (!candidate) return null;
    return VIDEO_ID_PATTERNS.bilibili.test(candidate) ? { provider, id: candidate } : null;
  }

  if (provider === "tencent") {
    // https://v.qq.com/x/page/<vid>.html
    // https://v.qq.com/x/cover/<cid>/<vid>.html
    const last = parts[parts.length - 1];
    if (!last) return null;
    const candidate = last.replace(/\.html?$/i, "");
    return VIDEO_ID_PATTERNS.tencent.test(candidate) ? { provider, id: candidate } : null;
  }

  // youku: https://v.youku.com/v_show/id_<id>.html
  const last = parts[parts.length - 1];
  if (!last) return null;
  const match = /^id_(.+?)\.html?$/i.exec(last);
  const candidate = match ? match[1] : "";
  return candidate && VIDEO_ID_PATTERNS.youku.test(candidate) ? { provider, id: candidate } : null;
}

/** 唯一允许产出 iframe src 的地方。 */
export function buildGalleryVideoEmbedUrl(provider: GalleryVideoProvider | "", id: string): string {
  if (!provider || !id) return "";
  if (!VIDEO_ID_PATTERNS[provider]?.test(id)) return "";
  const encoded = encodeURIComponent(id);
  switch (provider) {
    case "bilibili":
      return `https://player.bilibili.com/player.html?bvid=${encoded}&autoplay=0&high_quality=1`;
    case "tencent":
      return `https://v.qq.com/txp/iframe/player.html?vid=${encoded}`;
    case "youku":
      return `https://player.youku.com/embed/${encoded}`;
    default:
      return "";
  }
}

/** 「在原站打开」用的普通播放页链接。 */
export function buildGalleryVideoPageUrl(provider: GalleryVideoProvider | "", id: string): string {
  if (!provider || !id) return "";
  if (!VIDEO_ID_PATTERNS[provider]?.test(id)) return "";
  const encoded = encodeURIComponent(id);
  switch (provider) {
    case "bilibili":
      return `https://www.bilibili.com/video/${encoded}`;
    case "tencent":
      return `https://v.qq.com/x/page/${encoded}.html`;
    case "youku":
      return `https://v.youku.com/v_show/id_${encoded}.html`;
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// 条目校验
// ---------------------------------------------------------------------------

function normalizeMediaType(value: unknown): GalleryMediaType | null {
  const raw = String(value ?? "").trim();
  return (GALLERY_MEDIA_TYPES as readonly string[]).includes(raw)
    ? (raw as GalleryMediaType)
    : null;
}

/** 从 input 里取视频引用：既接受 {video_provider, video_id}，也接受粘贴的播放页 URL。 */
function resolveVideoRef(input: Record<string, unknown>): GalleryVideoRef | null {
  const provider = String(input.video_provider ?? "").trim().toLowerCase();
  const id = String(input.video_id ?? "").trim();
  if (provider && id && (GALLERY_VIDEO_PROVIDERS as readonly string[]).includes(provider)) {
    const p = provider as GalleryVideoProvider;
    if (VIDEO_ID_PATTERNS[p].test(id)) return { provider: p, id };
    return null;
  }
  return parseGalleryVideoRef(input.video_url ?? input.video_page_url ?? input.videoUrl);
}

/** 创建：全字段校验。 */
export function normalizeGalleryItemInput(input: unknown): NormalizeResult<GalleryItemInput> {
  if (!input || typeof input !== "object") return fail("请求体无效");
  const raw = input as Record<string, unknown>;

  const mediaType = normalizeMediaType(raw.media_type);
  if (!mediaType) return fail("media_type 无效，只支持 image / text / video_embed");

  const title = boundedSingleLineText(raw.title, MAX_TITLE_CHARS);
  const caption = boundedMultilineText(raw.caption, MAX_CAPTION_CHARS);

  let imageUrl = "";
  let videoProvider: GalleryVideoProvider | "" = "";
  let videoId = "";

  if (mediaType === "image") {
    imageUrl = normalizeInternalUploadUrl(raw.image_url);
    if (!imageUrl) return fail("图片必须使用站内上传地址");
  } else if (mediaType === "text") {
    if (!title && !caption) return fail("文字卡至少需要填写标题或说明文案");
  } else {
    const ref = resolveVideoRef(raw);
    if (!ref) return fail("暂不支持该视频站点或链接格式，请使用 B 站 / 腾讯视频 / 优酷的播放页地址");
    videoProvider = ref.provider;
    videoId = ref.id;
  }

  const linkUrl = normalizePublicWebsiteUrl(raw.link_url);
  const linkedProjectId =
    raw.linked_project_id === null || raw.linked_project_id === undefined || raw.linked_project_id === ""
      ? null
      : normalizeUuid(raw.linked_project_id);
  if (raw.linked_project_id && !linkedProjectId) return fail("linked_project_id 不是合法的项目 ID");
  if (linkUrl && linkedProjectId) return fail("跳转链接与关联项目只能二选一");

  return ok({
    media_type: mediaType,
    image_url: imageUrl,
    title,
    caption,
    link_url: linkUrl,
    linked_project_id: linkedProjectId,
    video_provider: videoProvider,
    video_id: videoId,
    sort_index: normalizeSortIndex(raw.sort_index),
    is_enabled: raw.is_enabled !== false,
  });
}

/**
 * 更新：只处理出现过的键。
 *
 * media_type 一旦出现就走全量校验（因为类型切换会连带清空/要求其它字段），
 * 否则只对出现的单个字段做校验。
 */
export function normalizeGalleryItemPatch(
  input: unknown,
): NormalizeResult<Partial<GalleryItemInput>> {
  if (!input || typeof input !== "object") return fail("请求体无效");
  const raw = input as Record<string, unknown>;
  const patch: Partial<GalleryItemInput> = {};

  if ("media_type" in raw) {
    const full = normalizeGalleryItemInput(raw);
    if (!full.ok) return full;
    return ok(full.value);
  }

  if ("image_url" in raw) {
    const url = normalizeInternalUploadUrl(raw.image_url);
    if (!url) return fail("图片必须使用站内上传地址");
    patch.image_url = url;
  }

  if ("title" in raw) patch.title = boundedSingleLineText(raw.title, MAX_TITLE_CHARS);
  if ("caption" in raw) patch.caption = boundedMultilineText(raw.caption, MAX_CAPTION_CHARS);

  if ("link_url" in raw) {
    const value = String(raw.link_url ?? "").trim();
    if (!value) {
      patch.link_url = "";
    } else {
      const url = normalizePublicWebsiteUrl(value);
      if (!url) return fail("跳转链接必须是合法的 http/https 地址");
      patch.link_url = url;
    }
  }

  if ("linked_project_id" in raw) {
    const value = raw.linked_project_id;
    if (value === null || value === undefined || value === "") {
      patch.linked_project_id = null;
    } else {
      const id = normalizeUuid(value);
      if (!id) return fail("linked_project_id 不是合法的项目 ID");
      patch.linked_project_id = id;
    }
  }

  if (patch.link_url && patch.linked_project_id) {
    return fail("跳转链接与关联项目只能二选一");
  }

  if ("video_url" in raw || "video_provider" in raw || "video_id" in raw) {
    const ref = resolveVideoRef(raw);
    if (!ref) return fail("暂不支持该视频站点或链接格式");
    patch.video_provider = ref.provider;
    patch.video_id = ref.id;
  }

  if ("sort_index" in raw) patch.sort_index = normalizeSortIndex(raw.sort_index);
  if ("is_enabled" in raw) patch.is_enabled = raw.is_enabled !== false;

  return ok(patch);
}

/** 排序：[{ id, sort_index }]，去重、限长、UUID 校验。 */
export function normalizeGalleryOrderInput(
  input: unknown,
): NormalizeResult<Array<{ id: string; sort_index: number }>> {
  if (!Array.isArray(input)) return fail("orders 必须是数组");
  if (input.length > MAX_GALLERY_ORDER_ENTRIES) return fail("排序条目过多");

  const seen = new Set<string>();
  const result: Array<{ id: string; sort_index: number }> = [];
  for (const entry of input) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const id = normalizeUuid(row.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push({ id, sort_index: normalizeSortIndex(row.sort_index) });
  }
  if (result.length === 0) return fail("没有有效的排序条目");
  return ok(result);
}

/** 埋点上报体：静默丢弃非法项，不报错（埋点不该因脏数据打断用户）。 */
export function normalizeGalleryTrackPayload(
  input: unknown,
): Array<{ itemId: string; type: "impression" | "click" }> {
  if (!Array.isArray(input)) return [];
  const result: Array<{ itemId: string; type: "impression" | "click" }> = [];
  for (const entry of input) {
    if (result.length >= MAX_GALLERY_TRACK_EVENTS) break;
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const itemId = normalizeUuid(row.itemId ?? row.item_id);
    if (!itemId) continue;
    const type = String(row.type ?? "").trim();
    if (type !== "impression" && type !== "click") continue;
    result.push({ itemId, type });
  }
  return result;
}
