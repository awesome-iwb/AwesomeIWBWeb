import crypto from "crypto";
import {
  buildVariantKey,
  fileExists,
  readFile as storageReadFile,
  thumbSidecarKey,
  type StorageLayout,
  writeFile as storageWriteFile,
} from "./storage";
import { upsertMediaVariant } from "./media";

export const ALLOWED_THUMB_WIDTHS = [128, 200, 400, 800] as const;
export const THUMB_TRANSFORM_VERSION = 1;
const inFlight = new Map<string, Promise<{ buffer: Buffer; mime: string; cacheKey: string } | null>>();

export function parseThumbWidth(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const width = Number(raw);
  if (!Number.isInteger(width)) return null;
  return (ALLOWED_THUMB_WIDTHS as readonly number[]).includes(width) ? width : null;
}

export async function getOrCreateThumbnail(
  sourceKey: string,
  width: number,
  options: {
    sourceLayout?: StorageLayout;
    sourceSha256?: string;
    blobId?: string | null;
  } = {},
): Promise<{ buffer: Buffer; mime: string; cacheKey: string } | null> {
  const normalizedWidth = parseThumbWidth(width);
  if (!normalizedWidth) return null;
  const sourceLayout = options.sourceLayout ?? "legacy";
  const cacheKey = options.sourceSha256
    ? buildVariantKey(options.sourceSha256, normalizedWidth, THUMB_TRANSFORM_VERSION)
    : thumbSidecarKey(sourceKey, normalizedWidth);
  const cacheLayout: StorageLayout = options.sourceSha256 ? "v2" : sourceLayout;

  const existing = inFlight.get(cacheKey);
  if (existing) return existing;
  const task = createThumbnail({
    sourceKey,
    sourceLayout,
    width: normalizedWidth,
    cacheKey,
    cacheLayout,
    blobId: options.blobId ?? null,
  });
  inFlight.set(cacheKey, task);
  try {
    return await task;
  } finally {
    inFlight.delete(cacheKey);
  }
}

async function createThumbnail(input: {
  sourceKey: string;
  sourceLayout: StorageLayout;
  width: number;
  cacheKey: string;
  cacheLayout: StorageLayout;
  blobId: string | null;
}): Promise<{ buffer: Buffer; mime: string; cacheKey: string } | null> {
  if (await fileExists(input.cacheKey, input.cacheLayout)) {
    const cached = await storageReadFile(input.cacheKey, input.cacheLayout);
    return cached ? { buffer: cached.buffer, mime: "image/webp", cacheKey: input.cacheKey } : null;
  }

  const source = await storageReadFile(input.sourceKey, input.sourceLayout);
  if (!source) return null;

  try {
    const sharp = await import("sharp");
    const resized = await sharp
      .default(source.buffer, { failOn: "error", limitInputPixels: 25_000_000, sequentialRead: true })
      .rotate()
      .resize({ width: input.width, withoutEnlargement: true, fit: "inside" })
      .webp({ quality: 82, smartSubsample: true })
      .toBuffer({ resolveWithObject: true });
    const variantHash = crypto.createHash("sha256").update(resized.data).digest("hex");
    await storageWriteFile(input.cacheKey, resized.data, {
      layout: input.cacheLayout,
      expectedSha256: variantHash,
    });
    if (input.blobId && input.cacheLayout === "v2") {
      await upsertMediaVariant({
        blobId: input.blobId,
        preset: `w${input.width}`,
        transformVersion: THUMB_TRANSFORM_VERSION,
        objectKey: input.cacheKey,
        sha256: variantHash,
        mime: "image/webp",
        size: resized.data.length,
        width: resized.info.width,
        height: resized.info.height,
      });
    }
    return { buffer: resized.data, mime: "image/webp", cacheKey: input.cacheKey };
  } catch (err) {
    console.error("[thumbnails] failed to generate thumbnail:", err);
    return null;
  }
}
