import { describe, expect, test } from "bun:test";
import {
  extFromMime,
  validateImageMime,
  validateImageSignature,
} from "../services/imageUpload";
import { parseThumbWidth } from "../services/thumbnails";
import { buildKey, thumbSidecarKey } from "../services/storage";

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
});

describe("storage namespaces", () => {
  test("buildKey with entity grouping prefixes namespace", () => {
    expect(buildKey("abc.webp", "entity", "content")).toBe("content/abc.webp");
    expect(buildKey("abc.webp", "entity", "avatars")).toBe("avatars/abc.webp");
  });

  test("thumbSidecarKey keeps directory", () => {
    expect(thumbSidecarKey("content/abc.jpg", 128)).toBe("content/abc.w128.webp");
  });
});

describe("thumbnails", () => {
  test("parseThumbWidth clamps invalid values", () => {
    expect(parseThumbWidth(undefined)).toBeNull();
    expect(parseThumbWidth("200")).toBe(200);
    expect(parseThumbWidth("-1")).toBeNull();
    expect(parseThumbWidth("9999")).toBe(800);
  });
});
