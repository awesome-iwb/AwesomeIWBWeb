import crypto from "crypto";
import { sql } from "../db/client";
import {
  buildObjectKey,
  readFile,
  writeFile,
  type StorageLayout,
  type StoredFile,
} from "../services/storage";

export type BlobRow = {
  id: string;
  sha256: string;
  object_key: string;
  storage_layout: StorageLayout;
  mime: string;
  state: string;
};

export type MigrationOptions = {
  apply: boolean;
  limit: number | null;
};

export type MigrationIo = {
  read(key: string, layout: StorageLayout): Promise<StoredFile | null>;
  write(key: string, buffer: Buffer, expectedSha256: string): Promise<void>;
};

export type BlobMigrationResult = {
  status: "missing" | "planned" | "verified";
  targetKey: string;
  actualSha256: string | null;
  copied: boolean;
  reusedTarget: boolean;
  error?: "LEGACY_SOURCE_MISSING" | "V2_OBJECT_MISSING";
};

export class MigrationIntegrityError extends Error {
  readonly code: string;
  readonly actualSha256: string | null;
  readonly targetKey: string;

  constructor(code: string, targetKey: string, actualSha256: string | null = null) {
    super(code);
    this.name = "MigrationIntegrityError";
    this.code = code;
    this.actualSha256 = actualSha256;
    this.targetKey = targetKey;
  }
}

const defaultIo: MigrationIo = {
  read: readFile,
  async write(key, buffer, expectedSha256) {
    await writeFile(key, buffer, { layout: "v2", expectedSha256 });
  },
};

export function parseMigrationOptions(argv: string[]): MigrationOptions {
  if (argv.includes("--apply") && argv.includes("--dry-run")) {
    throw new Error("MIGRATION_MODE_CONFLICT");
  }
  const apply = argv.includes("--apply");
  const limitArgs = argv.filter((arg) => arg.startsWith("--limit="));
  if (limitArgs.length > 1) throw new Error("MIGRATION_LIMIT_REPEATED");
  if (!limitArgs.length) return { apply, limit: null };
  const raw = limitArgs[0].slice("--limit=".length);
  if (!/^\d+$/.test(raw) || Number(raw) < 1 || !Number.isSafeInteger(Number(raw))) {
    throw new Error("MIGRATION_LIMIT_INVALID");
  }
  return { apply, limit: Number(raw) };
}

function extensionForMime(mime: string): string {
  const normalized = String(mime ?? "").trim().toLowerCase();
  if (normalized === "image/png") return "png";
  if (normalized === "image/jpeg") return "jpg";
  if (normalized === "image/webp") return "webp";
  throw new Error(`UNSUPPORTED_BLOB_MIME:${mime}`);
}

export function sha256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function assertHash(buffer: Buffer, expectedSha256: string, code: string, targetKey: string): string {
  const actual = sha256(buffer);
  if (actual !== expectedSha256.toLowerCase()) {
    throw new MigrationIntegrityError(code, targetKey, actual);
  }
  return actual;
}

/**
 * Copies one legacy object into the immutable v2 layout. The legacy source is
 * only read. Existing v2 targets are reused only after a full SHA-256 check.
 */
export async function migrateBlob(
  blob: BlobRow,
  apply: boolean,
  io: MigrationIo = defaultIo,
): Promise<BlobMigrationResult> {
  const expectedSha256 = blob.sha256.toLowerCase();
  const canonicalTargetKey = buildObjectKey(expectedSha256, extensionForMime(blob.mime));

  if (blob.storage_layout === "v2") {
    const current = await io.read(blob.object_key, "v2");
    if (!current) {
      return {
        status: "missing",
        targetKey: blob.object_key,
        actualSha256: null,
        copied: false,
        reusedTarget: false,
        error: "V2_OBJECT_MISSING",
      };
    }
    const actualSha256 = assertHash(current.buffer, expectedSha256, "V2_HASH_MISMATCH", blob.object_key);
    return {
      status: "verified",
      targetKey: blob.object_key,
      actualSha256,
      copied: false,
      reusedTarget: true,
    };
  }

  const source = await io.read(blob.object_key, "legacy");
  if (!source) {
    return {
      status: "missing",
      targetKey: canonicalTargetKey,
      actualSha256: null,
      copied: false,
      reusedTarget: false,
      error: "LEGACY_SOURCE_MISSING",
    };
  }
  const sourceSha256 = assertHash(
    source.buffer,
    expectedSha256,
    "SOURCE_HASH_MISMATCH",
    canonicalTargetKey,
  );

  let target = await io.read(canonicalTargetKey, "v2");
  if (target) {
    assertHash(target.buffer, expectedSha256, "TARGET_HASH_MISMATCH", canonicalTargetKey);
  }

  if (!apply) {
    return {
      status: "planned",
      targetKey: canonicalTargetKey,
      actualSha256: sourceSha256,
      copied: false,
      reusedTarget: Boolean(target),
    };
  }

  let copied = false;
  if (!target) {
    try {
      await io.write(canonicalTargetKey, source.buffer, expectedSha256);
      copied = true;
    } catch (error) {
      // A concurrent process may have created the same content-addressed key.
      // It is safe to reuse only after reading and verifying the winner.
      target = await io.read(canonicalTargetKey, "v2");
      if (!target) throw error;
      assertHash(target.buffer, expectedSha256, "TARGET_WRITE_CONFLICT", canonicalTargetKey);
    }
  }

  target = await io.read(canonicalTargetKey, "v2");
  if (!target) throw new MigrationIntegrityError("TARGET_VERIFY_MISSING", canonicalTargetKey);
  const targetSha256 = assertHash(target.buffer, expectedSha256, "TARGET_VERIFY_FAILED", canonicalTargetKey);
  return {
    status: "verified",
    targetKey: canonicalTargetKey,
    actualSha256: targetSha256,
    copied,
    reusedTarget: !copied,
  };
}

async function recordItem(query: any, input: {
  runId: string | null;
  blob: BlobRow;
  targetKey: string;
  status: string;
  actualSha256?: string | null;
  error?: string | null;
}) {
  if (!input.runId) return;
  await query`
    insert into media_migration_items (
      run_id, blob_id, source_key, target_key, status, expected_sha256, actual_sha256, error, attempts, updated_at
    ) values (
      ${input.runId}, ${input.blob.id}, ${input.blob.object_key}, ${input.targetKey}, ${input.status},
      ${input.blob.sha256}, ${input.actualSha256 ?? null}, ${input.error ?? null}, 1, now()
    )
    on conflict (run_id, blob_id) do update set
      target_key = excluded.target_key, status = excluded.status, actual_sha256 = excluded.actual_sha256,
      error = excluded.error, attempts = media_migration_items.attempts + 1, updated_at = now()
  `;
}

async function activateMigratedBlob(query: any, blob: BlobRow, result: BlobMigrationResult): Promise<void> {
  const rows = await query`
    with updated_blob as (
      update media_blobs
      set object_key = ${result.targetKey}, storage_layout = 'v2', state = 'available', verified_at = now(), last_error = null
      where id = ${blob.id} and storage_layout = 'legacy' and sha256 = ${blob.sha256}
      returning id
    ), updated_assets as (
      update media_assets
      set integrity_status = 'verified', verified_at = now()
      where blob_id in (select id from updated_blob)
      returning id
    )
    select
      (select count(*)::int from updated_blob) as blob_count,
      (select count(*)::int from updated_assets) as asset_count
  ` as Array<{ blob_count: number; asset_count: number }>;
  if (Number(rows[0]?.blob_count ?? 0) !== 1) {
    throw new Error("MEDIA_BLOB_ACTIVATION_RACE");
  }
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const options = parseMigrationOptions(process.argv.slice(2));
  const db = sql();
  const connection = options.apply ? await db.reserve() : db;
  const summary = {
    total: 0,
    verified: 0,
    copied: 0,
    reused: 0,
    planned: 0,
    missing: 0,
    conflict: 0,
    failed: 0,
  };
  let runId: string | null = null;
  let lockHeld = false;
  let fatalError: unknown = null;

  try {
    if (options.apply) {
      const [lock] = await connection<Array<{ locked: boolean }>>`
        select pg_try_advisory_lock(hashtext('awesomeiwb-local-media-v2-migration')) as locked
      `;
      if (!lock?.locked) throw new Error("MEDIA_MIGRATION_ALREADY_RUNNING");
      lockHeld = true;
      await connection`
        update media_migration_runs
        set status = 'cancelled', finished_at = now(),
            summary = summary || '{"reason":"interrupted_before_next_run"}'::jsonb
        where status = 'running' and dry_run = false
      `;
      const [run] = await connection<Array<{ id: string }>>`
        insert into media_migration_runs(status, dry_run) values ('running', false) returning id
      `;
      runId = run.id;
    }

    const blobs = options.limit
      ? await connection<BlobRow[]>`
          select id, sha256, object_key, storage_layout, mime, state
          from media_blobs order by created_at asc limit ${options.limit}
        `
      : await connection<BlobRow[]>`
          select id, sha256, object_key, storage_layout, mime, state
          from media_blobs order by created_at asc
        `;
    summary.total = blobs.length;

    for (const blob of blobs) {
      let targetKey = blob.object_key;
      try {
        const result = await migrateBlob(blob, options.apply);
        targetKey = result.targetKey;
        if (result.status === "missing") {
          summary.missing++;
          await recordItem(connection, {
            runId,
            blob,
            targetKey,
            status: "missing",
            error: result.error,
          });
          console.warn(`[missing] ${blob.object_key}: ${result.error}`);
          continue;
        }
        if (result.status === "planned") {
          summary.planned++;
          if (result.reusedTarget) summary.reused++;
          console.log(`[dry-run] ${blob.object_key} -> ${targetKey}${result.reusedTarget ? " (verified target exists)" : ""}`);
          continue;
        }

        if (options.apply && blob.storage_layout === "legacy") {
          await activateMigratedBlob(connection, blob, result);
        }
        summary.verified++;
        if (result.copied) summary.copied++;
        if (result.reusedTarget) summary.reused++;
        await recordItem(connection, {
          runId,
          blob,
          targetKey,
          status: "verified",
          actualSha256: result.actualSha256,
        });
      } catch (error) {
        if (error instanceof MigrationIntegrityError) {
          summary.conflict++;
          targetKey = error.targetKey;
          await recordItem(connection, {
            runId,
            blob,
            targetKey,
            status: "conflict",
            actualSha256: error.actualSha256,
            error: error.code,
          });
        } else {
          summary.failed++;
          await recordItem(connection, {
            runId,
            blob,
            targetKey,
            status: "failed",
            error: String(error instanceof Error ? error.message : error).slice(0, 500),
          });
        }
        // Integrity failures and unexpected I/O/DB failures stop the run. A
        // later invocation safely resumes because source files are untouched
        // and existing targets are hash-verified before reuse.
        throw error;
      }
    }
  } catch (error) {
    fatalError = error;
    console.error(`[migration stopped] ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    if (runId) {
      await connection`
        update media_migration_runs
        set status = ${fatalError ? "failed" : "completed"}, finished_at = now(), summary = ${connection.json(summary)}
        where id = ${runId}
      `.catch((error: unknown) => console.error("failed to finalize migration run", error));
    }
    console.log(JSON.stringify({ apply: options.apply, runId, ...summary }, null, 2));
    if (lockHeld) {
      await connection`select pg_advisory_unlock(hashtext('awesomeiwb-local-media-v2-migration'))`.catch(() => undefined);
    }
    if (options.apply) connection.release();
    await db.end().catch(() => undefined);
  }

  if (fatalError) throw fatalError;
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
