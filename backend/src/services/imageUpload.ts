import crypto from "crypto";
import {
  buildKey,
  writeFile as storageWriteFile,
  publicUrl as storagePublicUrl,
  fileExists,
} from "./storage";
import { createOrGetMediaAssetFromUpload, findActiveMediaBySha256, type MediaAsset } from "./media";

const ALLOWED_MIMES = ["image/png", "image/jpeg", "image/webp"] as const;

export type ImageUploadNamespace = "avatars" | "content" | "projects";

export type ProcessImageUploadInput = {
  buffer: Buffer;
  mime: string;
  namespace: ImageUploadNamespace;
  source: string;
  uploaderId?: string | null;
};

export type ProcessImageUploadResult = {
  url: string;
  storage_key: string;
  media: MediaAsset | null;
  sha256: string;
  width: number | null;
  height: number | null;
};

export function extFromMime(mime: string): string | null {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return null;
}

export function validateImageMime(mime: string): mime is (typeof ALLOWED_MIMES)[number] {
  return (ALLOWED_MIMES as readonly string[]).includes(mime);
}

export function validateImageSignature(buffer: Buffer): boolean {
  const isPng =
    buffer.length > 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;
  const isJpeg = buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isWebp =
    buffer.length > 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP";
  return isPng || isJpeg || isWebp;
}

export async function readImageDimensions(
  buffer: Buffer,
): Promise<{ width: number | null; height: number | null }> {
  try {
    const sharp = await import("sharp");
    const meta = await sharp.default(buffer).metadata();
    return {
      width: typeof meta.width === "number" ? meta.width : null,
      height: typeof meta.height === "number" ? meta.height : null,
    };
  } catch {
    return { width: null, height: null };
  }
}

export async function processImageUpload(input: ProcessImageUploadInput): Promise<ProcessImageUploadResult> {
  const mime = String(input.mime || "");
  if (!validateImageMime(mime)) {
    throw new Error("UPLOAD_UNSUPPORTED_TYPE");
  }
  const ext = extFromMime(mime);
  if (!ext) {
    throw new Error("UPLOAD_UNSUPPORTED_TYPE");
  }
  if (!validateImageSignature(input.buffer)) {
    throw new Error("UPLOAD_INVALID_SIGNATURE");
  }

  const hash = crypto.createHash("sha256").update(input.buffer).digest("hex");
  const filename = `${hash}.${ext}`;
  const { width, height } = await readImageDimensions(input.buffer);

  const existing = await findActiveMediaBySha256(hash);
  if (existing?.storage_key && (await fileExists(existing.storage_key))) {
    const media = await createOrGetMediaAssetFromUpload({
      sha256: hash,
      storageKey: existing.storage_key,
      url: existing.url,
      mime: existing.mime || mime,
      size: existing.size || input.buffer.length,
      width: existing.width ?? width,
      height: existing.height ?? height,
      source: input.source,
      uploaderId: input.uploaderId,
    });
    return {
      url: existing.url,
      storage_key: existing.storage_key,
      media,
      sha256: hash,
      width: existing.width ?? width,
      height: existing.height ?? height,
    };
  }

  const key = buildKey(filename, "entity", input.namespace);
  await storageWriteFile(key, input.buffer);
  const url = storagePublicUrl(key);
  const media = await createOrGetMediaAssetFromUpload({
    sha256: hash,
    storageKey: key,
    url,
    mime,
    size: input.buffer.length,
    width,
    height,
    source: input.source,
    uploaderId: input.uploaderId,
  });

  return { url, storage_key: key, media, sha256: hash, width, height };
}

export async function bufferFromUploadFile(file: Blob | File): Promise<Buffer> {
  return Buffer.from(await file.arrayBuffer());
}
