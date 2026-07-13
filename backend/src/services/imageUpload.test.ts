import { describe, expect, test } from "bun:test";
import {
  assertSafeImageDimensions,
  extFromMime,
  normalizeUploadedImage,
  validateImageMime,
  validateImageSignature,
} from "../services/imageUpload";
import { parseThumbWidth } from "../services/thumbnails";
import { buildKey, normalizeStorageKey, resolveStoragePath, thumbSidecarKey } from "../services/storage";

describe("imageUpload helpers", () => {
  test("extFromMime maps supported types", () => {
    expect(extFromMime("image/png")).toBe("png");
    expect(extFromMime("image/jpeg")).toBe("jpg");
    expect(extFromMime("image/webp")).toBe("webp");
    expect(extFromMime("image/gif")).toBeNull();
  });

  test("validateImageMime accepts png/jpeg/webp", () => {
    expect(validateImageMime("image/png")).toBe(true);
    expect(validateImageMime("image/jpeg")).toBe(true);
    expect(validateImageMime("image/webp")).toBe(true);
    expect(validateImageMime("image/gif")).toBe(false);
  });

  test("validateImageSignature detects png header", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    expect(validateImageSignature(png)).toBe(true);
    expect(validateImageSignature(Buffer.from("not-an-image"))).toBe(false);
  });

  test("assertSafeImageDimensions rejects unreadable or excessive pixel dimensions", () => {
    expect(() => assertSafeImageDimensions({ width: 1, height: 1 })).not.toThrow();
    expect(() => assertSafeImageDimensions({ width: null, height: 1 })).toThrow("UPLOAD_INVALID_IMAGE");
    expect(() => assertSafeImageDimensions({ width: 100000, height: 100000 })).toThrow("UPLOAD_IMAGE_TOO_LARGE");
  });

  test("normalizeUploadedImage rejects a declared MIME that does not match decoded content", async () => {
    const sharp = await import("sharp");
    const jpeg = await sharp.default({
      create: { width: 2, height: 2, channels: 3, background: "#ffffff" },
    }).jpeg().toBuffer();

    await expect(normalizeUploadedImage(jpeg, "image/png")).rejects.toThrow("UPLOAD_MIME_MISMATCH");
  }, 15_000);

  test("normalizeUploadedImage decodes and re-encodes a supported image", async () => {
    const sharp = await import("sharp");
    const png = await sharp.default({
      create: { width: 3, height: 2, channels: 4, background: "#336699" },
    }).png().toBuffer();

    const normalized = await normalizeUploadedImage(png, "image/png");
    expect(normalized.mime).toBe("image/png");
    expect(normalized.extension).toBe("png");
    expect(normalized.width).toBe(3);
    expect(normalized.height).toBe(2);
    expect(validateImageSignature(normalized.buffer)).toBe(true);
  }, 15_000);
});

describe("storage namespaces", () => {
  test("buildKey with entity grouping prefixes namespace", () => {
    expect(buildKey("abc.webp", "entity", "content")).toBe("content/abc.webp");
    expect(buildKey("abc.webp", "entity", "avatars")).toBe("avatars/abc.webp");
  });

  test("thumbSidecarKey keeps directory", () => {
    expect(thumbSidecarKey("content/abc.jpg", 128)).toBe("content/abc.w128.webp");
  });

  test("normalizeStorageKey rejects path traversal and unsafe segments", () => {
    expect(normalizeStorageKey("/content/abc.webp")).toBe("content/abc.webp");
    expect(() => normalizeStorageKey("../secret.txt")).toThrow("INVALID_STORAGE_KEY");
    expect(() => normalizeStorageKey("content\\..\\secret.txt")).toThrow("INVALID_STORAGE_KEY");
    expect(() => normalizeStorageKey("content//abc.webp")).toThrow("INVALID_STORAGE_KEY");
    expect(() => normalizeStorageKey("content/\u0000.webp")).toThrow("INVALID_STORAGE_KEY");
  });

  test("resolveStoragePath rejects traversal attempts", () => {
    expect(resolveStoragePath("content/abc.webp")).toContain("content");
    expect(() => resolveStoragePath("content/../../data.json")).toThrow("INVALID_STORAGE_KEY");
  });
});

describe("thumbnails", () => {
  test("parseThumbWidth accepts only the fixed derivative presets", () => {
    expect(parseThumbWidth(undefined)).toBeNull();
    expect(parseThumbWidth("128")).toBe(128);
    expect(parseThumbWidth("200")).toBe(200);
    expect(parseThumbWidth("400")).toBe(400);
    expect(parseThumbWidth("800")).toBe(800);
    expect(parseThumbWidth("-1")).toBeNull();
    expect(parseThumbWidth("201")).toBeNull();
    expect(parseThumbWidth("9999")).toBeNull();
  });
});
