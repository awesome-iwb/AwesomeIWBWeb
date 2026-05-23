import {
  readFile as storageReadFile,
  writeFile as storageWriteFile,
  thumbSidecarKey,
  fileExists,
} from "./storage";

const MAX_THUMB_WIDTH = 800;

export function parseThumbWidth(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const width = Number(raw);
  if (!Number.isFinite(width) || width <= 0) return null;
  return Math.min(MAX_THUMB_WIDTH, Math.floor(width));
}

export async function getOrCreateThumbnail(
  sourceKey: string,
  width: number,
): Promise<{ buffer: Buffer; mime: string; cacheKey: string } | null> {
  const normalizedWidth = Math.min(MAX_THUMB_WIDTH, Math.max(1, Math.floor(width)));
  const cacheKey = thumbSidecarKey(sourceKey, normalizedWidth);

  if (await fileExists(cacheKey)) {
    const cached = await storageReadFile(cacheKey);
    return {
      buffer: Buffer.from(await cached.arrayBuffer()),
      mime: "image/webp",
      cacheKey,
    };
  }

  const source = await storageReadFile(sourceKey);
  if (!(await source.exists())) return null;

  try {
    const sharp = await import("sharp");
    const sourceBuffer = Buffer.from(await source.arrayBuffer());
    const resized = await sharp.default(sourceBuffer).resize(normalizedWidth).webp({ quality: 82 }).toBuffer();
    await storageWriteFile(cacheKey, resized);
    return { buffer: resized, mime: "image/webp", cacheKey };
  } catch (err) {
    console.error("[thumbnails] failed to generate thumbnail:", err);
    return null;
  }
}
