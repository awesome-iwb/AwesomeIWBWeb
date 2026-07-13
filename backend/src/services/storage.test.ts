import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import crypto from "crypto";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { appConfig } from "../config";
import {
  buildObjectKey,
  buildVariantKey,
  readFile,
  resolveStoragePath,
  writeFile,
} from "./storage";
import { getOrCreateThumbnail } from "./thumbnails";

const originalRoot = appConfig.storage.root;
const originalLegacyRoot = appConfig.storage.legacyRoot;
let testRoot = "";

beforeAll(async () => {
  testRoot = await fs.mkdtemp(path.join(os.tmpdir(), "awesomeiwb-media-storage-"));
  (appConfig.storage as { root: string; legacyRoot: string }).root = path.join(testRoot, "v2");
  (appConfig.storage as { root: string; legacyRoot: string }).legacyRoot = path.join(testRoot, "legacy");
});

afterAll(async () => {
  (appConfig.storage as { root: string; legacyRoot: string }).root = originalRoot;
  (appConfig.storage as { root: string; legacyRoot: string }).legacyRoot = originalLegacyRoot;
  if (testRoot) await fs.rm(testRoot, { recursive: true, force: true });
});

describe("content-addressed local storage", () => {
  test("builds deterministic sharded object and derivative keys", () => {
    const hash = "aabb" + "1".repeat(60);
    expect(buildObjectKey(hash, ".PNG")).toBe(`objects/sha256/aa/bb/${hash}.png`);
    expect(buildVariantKey(hash, 400)).toBe(`derivatives/sha256/aa/bb/${hash}/v1/w400.webp`);
    expect(buildVariantKey(hash, 400, 2)).toBe(`derivatives/sha256/aa/bb/${hash}/v2/w400.webp`);
  });

  test("rejects data whose checksum does not match its claimed identity", async () => {
    const data = Buffer.from("checksum-source");
    const wrongHash = "0".repeat(64);
    expect(writeFile("objects/checksum.bin", data, { expectedSha256: wrongHash })).rejects.toThrow(
      "STORAGE_CHECKSUM_MISMATCH",
    );
    expect(await readFile("objects/checksum.bin")).toBeNull();
  });

  test("concurrent writes of identical content converge on one immutable file", async () => {
    const data = Buffer.from("same immutable bytes");
    const hash = crypto.createHash("sha256").update(data).digest("hex");
    const key = buildObjectKey(hash, "bin");

    const results = await Promise.all(
      Array.from({ length: 8 }, () => writeFile(key, data, { expectedSha256: hash })),
    );
    expect(new Set(results).size).toBe(1);
    expect((await readFile(key))?.buffer.equals(data)).toBe(true);

    const directory = path.dirname(resolveStoragePath(key));
    const names = await fs.readdir(directory);
    expect(names.filter((name) => name.endsWith(".partial"))).toHaveLength(0);
  });

  test("never accepts different bytes at an existing immutable key", async () => {
    const key = "objects/conflict.bin";
    await writeFile(key, Buffer.from("AAAA"));
    expect(writeFile(key, Buffer.from("BBBB"))).rejects.toThrow("STORAGE_OBJECT_CONFLICT");
    expect((await readFile(key))?.buffer.toString()).toBe("AAAA");
  });

  test("keeps legacy and v2 roots physically separate", async () => {
    await writeFile("content/same-name.bin", Buffer.from("legacy"), { layout: "legacy" });
    await writeFile("content/same-name.bin", Buffer.from("v2"), { layout: "v2" });
    expect((await readFile("content/same-name.bin", "legacy"))?.buffer.toString()).toBe("legacy");
    expect((await readFile("content/same-name.bin", "v2"))?.buffer.toString()).toBe("v2");
  });

  test("coalesces concurrent fixed-preset thumbnail generation", async () => {
    const sharp = await import("sharp");
    const source = await sharp.default({
      create: { width: 640, height: 320, channels: 3, background: "#225588" },
    }).jpeg().toBuffer();
    const sourceKey = "content/thumbnail-source.jpg";
    await writeFile(sourceKey, source, { layout: "legacy" });

    const results = await Promise.all(
      Array.from({ length: 6 }, () => getOrCreateThumbnail(sourceKey, 200, { sourceLayout: "legacy" })),
    );
    expect(results.every((result) => result?.cacheKey === "content/thumbnail-source.w200.webp")).toBe(true);
    expect(results.every((result) => result?.buffer.equals(results[0]!.buffer))).toBe(true);
    expect(await readFile("content/thumbnail-source.w200.webp", "legacy")).not.toBeNull();
    expect(await getOrCreateThumbnail(sourceKey, 201, { sourceLayout: "legacy" })).toBeNull();
  }, 20_000);
});
