import fs from "fs/promises";
import path from "path";
import { sql } from "../db/client";
import { getStorageRoot } from "../services/storage";
import { listPurgeCandidates, type PurgeCandidate } from "../services/media";

export type PurgeOptions = {
  apply: boolean;
  enabled: boolean;
  minDays: number;
  backupMarkerPath: string;
  backupMaxAgeHours: number;
  requireRemoteBackup: boolean;
};

export type BackupMarker = {
  backupId: string;
  completedAtEpoch: number;
  localVerified: boolean;
  remoteVerified: boolean;
};

type LockedCandidate = {
  id: string;
  blob_id: string;
  object_key: string;
  storage_layout: "legacy" | "v2";
  variant_count: number;
};

type PurgeResult = {
  status: "purged" | "skipped";
  reason?: string;
  variantsRetained: number;
};

function parsePositiveNumber(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name}_INVALID`);
  return value;
}

export function parsePurgeOptions(
  argv: string[],
  env: Record<string, string | undefined> = process.env,
): PurgeOptions {
  if (argv.includes("--apply") && argv.includes("--dry-run")) {
    throw new Error("PURGE_MODE_CONFLICT");
  }
  const minDays = parsePositiveNumber("PURGE_MIN_DAYS", env.PURGE_MIN_DAYS, 30);
  if (!Number.isSafeInteger(minDays)) throw new Error("PURGE_MIN_DAYS_INVALID");
  return {
    // --dry-run remains accepted for old runbooks, but dry-run is the default.
    // Mutation requires both --apply and MEDIA_PURGE_ENABLED=true.
    apply: argv.includes("--apply"),
    enabled: env.MEDIA_PURGE_ENABLED === "true",
    minDays,
    backupMarkerPath: env.MEDIA_BACKUP_MARKER?.trim() || path.join(getStorageRoot(), ".backup-last-success"),
    backupMaxAgeHours: parsePositiveNumber("PURGE_BACKUP_MAX_AGE_HOURS", env.PURGE_BACKUP_MAX_AGE_HOURS, 36),
    requireRemoteBackup: env.PURGE_REQUIRE_REMOTE_BACKUP !== "false",
  };
}

export function parseBackupMarker(raw: string): BackupMarker {
  const values = new Map<string, string>();
  for (const line of raw.split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    values.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
  }
  const completedAtEpoch = Number(values.get("completed_at_epoch"));
  const backupId = values.get("backup_id") ?? "";
  if (!backupId || !Number.isSafeInteger(completedAtEpoch) || completedAtEpoch <= 0) {
    throw new Error("MEDIA_BACKUP_MARKER_INVALID");
  }
  return {
    backupId,
    completedAtEpoch,
    localVerified: values.get("local_verified") === "true",
    remoteVerified: values.get("remote_verified") === "true",
  };
}

export function assertFreshBackup(
  marker: BackupMarker,
  options: Pick<PurgeOptions, "backupMaxAgeHours" | "requireRemoteBackup">,
  nowEpoch = Math.floor(Date.now() / 1000),
): void {
  if (!marker.localVerified) throw new Error("MEDIA_BACKUP_NOT_VERIFIED");
  if (options.requireRemoteBackup && !marker.remoteVerified) {
    throw new Error("MEDIA_REMOTE_BACKUP_NOT_VERIFIED");
  }
  const ageSeconds = nowEpoch - marker.completedAtEpoch;
  if (ageSeconds < -300) throw new Error("MEDIA_BACKUP_MARKER_FROM_FUTURE");
  if (ageSeconds > options.backupMaxAgeHours * 3600) throw new Error("MEDIA_BACKUP_STALE");
}

async function loadAndAssertFreshBackup(options: PurgeOptions): Promise<BackupMarker> {
  let raw: string;
  try {
    raw = await fs.readFile(options.backupMarkerPath, "utf8");
  } catch (error: any) {
    if (error?.code === "ENOENT") throw new Error("MEDIA_BACKUP_MARKER_MISSING");
    throw error;
  }
  const marker = parseBackupMarker(raw);
  assertFreshBackup(marker, options);
  return marker;
}

/**
 * Online purge intentionally removes only the logical asset row. The
 * immutable original and reproducible variants stay on disk and keep their DB
 * blob/variant metadata. Physical GC requires a separate maintenance window
 * with uploads stopped, an exclusive lock, a persistent journal and restore
 * testing; doing it online creates crash and same-SHA upload races.
 */
async function purgeLogicalAsset(
  connection: any,
  candidate: PurgeCandidate,
  minDays: number,
): Promise<PurgeResult> {
  await connection`begin`;
  try {
    const rows = (await connection`
      select
        m.id,
        m.blob_id,
        b.object_key,
        b.storage_layout,
        (select count(*)::int from media_variants v where v.blob_id = b.id) as variant_count
      from media_assets m
      join media_blobs b on b.id = m.blob_id
      where m.id = ${candidate.id}
        and m.status = 'deleted'
        and m.deleted_at is not null
        and m.deleted_at < now() - (${minDays}::text || ' days')::interval
        and not exists (select 1 from media_references r where r.media_id = m.id)
        and not exists (
          select 1 from media_assets other
          where other.blob_id = m.blob_id and other.id <> m.id
        )
      for update of m, b
    `) as LockedCandidate[];
    const locked = rows[0];
    if (!locked) {
      await connection`commit`;
      return { status: "skipped", reason: "candidate_changed", variantsRetained: 0 };
    }
    if (locked.storage_layout !== "v2") {
      await connection`commit`;
      return { status: "skipped", reason: "legacy_read_only", variantsRetained: 0 };
    }

    const deleted = await connection`
      delete from media_assets m
      where m.id = ${locked.id}
        and m.status = 'deleted'
        and not exists (select 1 from media_references r where r.media_id = m.id)
      returning m.id
    `;
    if (deleted.length !== 1) throw new Error("PURGE_ASSET_DELETE_RACE");
    const quarantined = await connection`
      update media_blobs
      set state = 'quarantined', last_error = 'ONLINE_PURGE_RETAINED_PHYSICAL_OBJECT'
      where id = ${locked.blob_id}
        and not exists (select 1 from media_assets m where m.blob_id = media_blobs.id)
      returning id
    `;
    if (quarantined.length !== 1) throw new Error("PURGE_BLOB_QUARANTINE_RACE");
    const result: PurgeResult = {
      status: "purged",
      variantsRetained: Number(locked.variant_count) || 0,
    };
    await connection`commit`;
    return result;
  } catch (error) {
    await connection`rollback`.catch(() => undefined);
    throw error;
  }
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const options = parsePurgeOptions(process.argv.slice(2));
  if (options.apply && !options.enabled) {
    throw new Error("MEDIA_PURGE_DISABLED: set MEDIA_PURGE_ENABLED=true and pass --apply");
  }

  let marker: BackupMarker | null = null;
  try {
    marker = await loadAndAssertFreshBackup(options);
  } catch (error) {
    if (options.apply) throw error;
    console.warn(`[dry-run] purge apply gate is closed: ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log(`=== purge deleted, unreferenced local media ${options.apply ? "(APPLY)" : "(dry-run)"} ===`);
  console.log(`minimum retention: ${options.minDays} days`);
  console.log(`fresh backup: ${marker ? marker.backupId : "not available"}`);
  console.log(`remote backup required: ${options.requireRemoteBackup}`);
  console.log("physical policy: retain immutable originals and variants; online purge is logical only");

  const db = sql();
  const connection = options.apply ? await db.reserve() : db;
  let lockHeld = false;
  const summary = {
    candidates: 0,
    logicalAssetsPurged: 0,
    physicalBlobsRetained: 0,
    variantsRetained: 0,
    eligibleDryRun: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    if (options.apply) {
      const [lock] = await connection<Array<{ locked: boolean }>>`
        select pg_try_advisory_lock(hashtext('awesomeiwb-local-media-v2-purge')) as locked
      `;
      if (!lock?.locked) throw new Error("MEDIA_PURGE_ALREADY_RUNNING");
      lockHeld = true;
    }

    const candidates = await listPurgeCandidates(options.minDays);
    summary.candidates = candidates.length;
    for (const candidate of candidates) {
      console.log(`- ${candidate.id} ${candidate.object_key} (deleted_at=${candidate.deleted_at})`);
      if (
        candidate.ref_count !== 0 ||
        candidate.storage_layout !== "v2" ||
        !candidate.blob_id ||
        candidate.blob_asset_count !== 1
      ) {
        summary.skipped++;
        console.log("  skipped: not an exclusive, zero-reference v2 blob");
        continue;
      }
      if (!options.apply) {
        summary.eligibleDryRun++;
        console.log("  [dry-run] eligible; logical row, original and variants unchanged");
        continue;
      }

      try {
        const result = await purgeLogicalAsset(connection, candidate, options.minDays);
        if (result.status === "skipped") {
          summary.skipped++;
          console.log(`  skipped after locked recheck: ${result.reason}`);
          continue;
        }
        summary.logicalAssetsPurged++;
        summary.physicalBlobsRetained++;
        summary.variantsRetained += result.variantsRetained;
      } catch (error) {
        summary.errors++;
        console.error(`  purge failed ${candidate.id}:`, error);
        throw error;
      }
    }
  } finally {
    console.log(JSON.stringify(summary, null, 2));
    if (lockHeld) {
      await connection`select pg_advisory_unlock(hashtext('awesomeiwb-local-media-v2-purge'))`.catch(() => undefined);
    }
    if (options.apply) connection.release();
    await db.end().catch(() => undefined);
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error("media purge stopped:", error);
    process.exit(1);
  });
}
