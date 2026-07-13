import { describe, expect, test } from "bun:test";
import {
  MigrationIntegrityError,
  migrateBlob,
  parseMigrationOptions,
  sha256,
  type BlobRow,
  type MigrationIo,
} from "./migrate-local-media-v2";
import type { StorageLayout, StoredFile } from "../services/storage";

function legacyBlob(buffer: Buffer): BlobRow {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    sha256: sha256(buffer),
    object_key: "content/legacy.png",
    storage_layout: "legacy",
    mime: "image/png",
    state: "available",
  };
}

function stored(buffer: Buffer): StoredFile {
  return { buffer, size: buffer.length, modifiedAt: new Date(0) };
}

function memoryIo(blob: BlobRow, source: Buffer | null, initialV2 = new Map<string, Buffer>()) {
  const writes: string[] = [];
  const io: MigrationIo = {
    async read(key: string, layout: StorageLayout) {
      if (layout === "legacy") return key === blob.object_key && source ? stored(source) : null;
      const value = initialV2.get(key);
      return value ? stored(value) : null;
    },
    async write(key, buffer) {
      writes.push(key);
      if (initialV2.has(key)) throw new Error("STORAGE_OBJECT_CONFLICT");
      initialV2.set(key, Buffer.from(buffer));
    },
  };
  return { io, writes, v2: initialV2 };
}

describe("local media v2 migration", () => {
  test("is dry-run unless --apply is explicitly present", () => {
    expect(parseMigrationOptions([])).toEqual({ apply: false, limit: null });
    expect(parseMigrationOptions(["--dry-run"])).toEqual({ apply: false, limit: null });
    expect(parseMigrationOptions(["--apply", "--limit=10"])).toEqual({ apply: true, limit: 10 });
    expect(() => parseMigrationOptions(["--apply", "--dry-run"])).toThrow("MIGRATION_MODE_CONFLICT");
    expect(() => parseMigrationOptions(["--limit=0"])).toThrow("MIGRATION_LIMIT_INVALID");
    expect(() => parseMigrationOptions(["--limit=nope"])).toThrow("MIGRATION_LIMIT_INVALID");
  });

  test("reports a missing legacy source without writing a target", async () => {
    const expected = Buffer.from("expected");
    const blob = legacyBlob(expected);
    const { io, writes } = memoryIo(blob, null);
    const result = await migrateBlob(blob, true, io);
    expect(result.status).toBe("missing");
    expect(result.error).toBe("LEGACY_SOURCE_MISSING");
    expect(writes).toEqual([]);
  });

  test("stops before copying when the legacy SHA-256 does not match", async () => {
    const blob = legacyBlob(Buffer.from("expected"));
    const { io, writes } = memoryIo(blob, Buffer.from("tampered"));
    await expect(migrateBlob(blob, true, io)).rejects.toMatchObject<Partial<MigrationIntegrityError>>({
      code: "SOURCE_HASH_MISMATCH",
    });
    expect(writes).toEqual([]);
  });

  test("dry-run verifies the source and existing target but never copies", async () => {
    const source = Buffer.from("image bytes");
    const blob = legacyBlob(source);
    const { io, writes } = memoryIo(blob, source);
    const result = await migrateBlob(blob, false, io);
    expect(result.status).toBe("planned");
    expect(result.reusedTarget).toBe(false);
    expect(writes).toEqual([]);
  });

  test("rejects an existing target with different content", async () => {
    const source = Buffer.from("image bytes");
    const blob = legacyBlob(source);
    const first = memoryIo(blob, source);
    const plan = await migrateBlob(blob, false, first.io);
    first.v2.set(plan.targetKey, Buffer.from("conflicting bytes"));
    await expect(migrateBlob(blob, true, first.io)).rejects.toMatchObject<Partial<MigrationIntegrityError>>({
      code: "TARGET_HASH_MISMATCH",
    });
    expect(first.writes).toEqual([]);
  });

  test("is idempotent after a copy or an interruption before the DB update", async () => {
    const source = Buffer.from("image bytes");
    const blob = legacyBlob(source);
    const memory = memoryIo(blob, source);
    const first = await migrateBlob(blob, true, memory.io);
    expect(first.copied).toBe(true);
    expect(memory.writes).toHaveLength(1);

    // Simulates restarting while the DB row still says legacy. The verified
    // content-addressed target is reused and the legacy source remains intact.
    const second = await migrateBlob(blob, true, memory.io);
    expect(second.copied).toBe(false);
    expect(second.reusedTarget).toBe(true);
    expect(memory.writes).toHaveLength(1);
  });
});
