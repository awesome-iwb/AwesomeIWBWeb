import crypto from "crypto";
import { appConfig } from "../config";
import {
  buildKey,
  buildObjectKey,
  fileExists,
  publicUrl as storagePublicUrl,
  writeFile as storageWriteFile,
} from "./storage";
import {
  activateReservedMedia,
  failReservedMedia,
  findActiveMediaBySha256,
  markBlobAvailable,
  reserveMediaAssetFromUpload,
  type MediaAsset,
} from "./media";

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
  object_key: string;
  media: MediaAsset | null;
  sha256: string;
  original_sha256: string;
  width: number;
  height: number;
  mime: (typeof ALLOWED_MIMES)[number];
};

type NormalizedImage = {
  buffer: Buffer;
  mime: (typeof ALLOWED_MIMES)[number];
  extension: "png" | "jpg" | "webp";
  width: number;
  height: number;
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

function mimeFromSharpFormat(format: string | undefined): NormalizedImage["mime"] | null {
  if (format === "png") return "image/png";
  if (format === "jpeg") return "image/jpeg";
  if (format === "webp") return "image/webp";
  return null;
}

export async function readImageDimensions(
  buffer: Buffer,
): Promise<{ width: number | null; height: number | null }> {
  try {
    const sharp = await import("sharp");
    const meta = await sharp.default(buffer, {
      failOn: "error",
      limitInputPixels: appConfig.uploadMaxPixels,
      sequentialRead: true,
    }).metadata();
    return {
      width: typeof meta.width === "number" ? meta.width : null,
      height: typeof meta.height === "number" ? meta.height : null,
    };
  } catch {
    return { width: null, height: null };
  }
}

export function assertSafeImageDimensions(dimensions: { width: number | null; height: number | null }) {
  const { width, height } = dimensions;
  if (!width || !height || width <= 0 || height <= 0) {
    throw new Error("UPLOAD_INVALID_IMAGE");
  }
  if (width * height > appConfig.uploadMaxPixels) {
    throw new Error("UPLOAD_IMAGE_TOO_LARGE");
  }
}

export async function normalizeUploadedImage(buffer: Buffer, declaredMime: string): Promise<NormalizedImage> {
  if (!validateImageMime(declaredMime)) throw new Error("UPLOAD_UNSUPPORTED_TYPE");
  if (!validateImageSignature(buffer)) throw new Error("UPLOAD_INVALID_SIGNATURE");

  const sharp = await import("sharp");
  const inputOptions = {
    failOn: "error" as const,
    limitInputPixels: appConfig.uploadMaxPixels,
    sequentialRead: true,
    animated: false,
  };
  let metadata;
  try {
    metadata = await sharp.default(buffer, inputOptions).metadata();
  } catch {
    throw new Error("UPLOAD_INVALID_IMAGE");
  }
  const detectedMime = mimeFromSharpFormat(metadata.format);
  if (!detectedMime) throw new Error("UPLOAD_UNSUPPORTED_TYPE");
  if (detectedMime !== declaredMime) throw new Error("UPLOAD_MIME_MISMATCH");
  if ((metadata.pages ?? 1) > 1) throw new Error("UPLOAD_ANIMATED_NOT_ALLOWED");
  assertSafeImageDimensions({ width: metadata.width ?? null, height: metadata.height ?? null });

  const pipeline = sharp.default(buffer, inputOptions).rotate();
  const output = detectedMime === "image/png"
    ? await pipeline.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer({ resolveWithObject: true })
    : detectedMime === "image/jpeg"
      ? await pipeline.jpeg({ quality: 90, mozjpeg: true }).toBuffer({ resolveWithObject: true })
      : await pipeline.webp({ quality: 88, smartSubsample: true }).toBuffer({ resolveWithObject: true });

  if (output.data.length > appConfig.uploadNormalizedMaxBytes) {
    throw new Error("UPLOAD_NORMALIZED_TOO_LARGE");
  }
  assertSafeImageDimensions({ width: output.info.width, height: output.info.height });
  return {
    buffer: output.data,
    mime: detectedMime,
    extension: detectedMime === "image/jpeg" ? "jpg" : detectedMime === "image/png" ? "png" : "webp",
    width: output.info.width,
    height: output.info.height,
  };
}

export async function processImageUpload(input: ProcessImageUploadInput): Promise<ProcessImageUploadResult> {
  if (input.buffer.length > appConfig.uploadMaxBytes) throw new Error("UPLOAD_FILE_TOO_LARGE");
  const originalHash = crypto.createHash("sha256").update(input.buffer).digest("hex");
  const normalized = await normalizeUploadedImage(input.buffer, String(input.mime || ""));
  const hash = crypto.createHash("sha256").update(normalized.buffer).digest("hex");
  const filename = `${hash}.${normalized.extension}`;
  const publicKey = buildKey(filename, "entity", input.namespace);
  const objectKey = buildObjectKey(hash, normalized.extension);

  const existing = await findActiveMediaBySha256(hash, input.namespace);
  if (existing?.object_key && (await fileExists(existing.object_key, existing.storage_layout))) {
    return {
      url: existing.url,
      storage_key: existing.storage_key,
      object_key: existing.object_key,
      media: existing,
      sha256: hash,
      original_sha256: originalHash,
      width: existing.width ?? normalized.width,
      height: existing.height ?? normalized.height,
      mime: validateImageMime(existing.mime) ? existing.mime : normalized.mime,
    };
  }

  const url = storagePublicUrl(publicKey);
  const reservation = await reserveMediaAssetFromUpload({
    sha256: hash,
    originalSha256: originalHash,
    objectKey,
    storageKey: publicKey,
    url,
    mime: normalized.mime,
    size: normalized.buffer.length,
    width: normalized.width,
    height: normalized.height,
    source: input.source,
    namespace: input.namespace,
    uploaderId: input.uploaderId,
  });

  try {
    await storageWriteFile(objectKey, normalized.buffer, { expectedSha256: hash, layout: "v2" });
    if (reservation?.blob_id) {
      await markBlobAvailable({ blobId: reservation.blob_id, objectKey, storageLayout: "v2" });
      await activateReservedMedia(reservation.id, reservation.blob_id);
    }
  } catch (error) {
    await failReservedMedia(reservation?.id ?? null, reservation?.blob_id ?? null, error).catch(() => undefined);
    throw error;
  }

  const media = reservation?.id ? await findActiveMediaBySha256(hash, input.namespace) : null;
  return {
    url,
    storage_key: publicKey,
    object_key: objectKey,
    media,
    sha256: hash,
    original_sha256: originalHash,
    width: normalized.width,
    height: normalized.height,
    mime: normalized.mime,
  };
}

export async function bufferFromUploadFile(file: Blob | File): Promise<Buffer> {
  return Buffer.from(await file.arrayBuffer());
}
