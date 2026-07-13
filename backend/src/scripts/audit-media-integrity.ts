import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { sql } from "../db/client";
import {
  getLegacyStorageRoot,
  getStorageRoot,
  normalizeStorageKey,
  readFile,
  type StorageLayout,
} from "../services/storage";

type Row = {
  media_id: string;
  blob_id: string | null;
  storage_key: string;
  url: string;
  status: string;
  expected_sha256: string;
  object_key: string;
  storage_layout: StorageLayout;
  mime: string;
  ref_count: number;
};

type BlobAuditRow = {
  blob_id: string;
  sha256: string;
  object_key: string;
  storage_layout: StorageLayout;
  state: string;
  asset_count: number;
};

type VariantAuditRow = {
  variant_id: string;
  blob_id: string;
  object_key: string;
  sha256: string;
  state: string;
};

type AliasAuditRow = { alias_path: string };

function sha256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export async function walk(root: string): Promise<string[]> {
  const output: string[] = [];
  async function visit(dir: string) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (error: any) {
      // A root or concurrently removed entry may genuinely be absent. Access,
      // I/O and filesystem corruption errors must fail the audit instead of
      // being misreported as an empty directory.
      if (error?.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await visit(full);
      else if (entry.isFile()) output.push(normalizeStorageKey(path.relative(root, full)));
    }
  }
  await visit(root);
  return output;
}

export async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const outputArg = process.argv.find((arg) => arg.startsWith("--output="));
  const outputPath = outputArg?.slice("--output=".length);
  const [rows, blobs, variants, aliases] = await Promise.all([
    sql()<Row[]>`
      select
        m.id as media_id, m.blob_id, m.storage_key, m.url, m.status,
        coalesce(b.sha256, lower(m.sha256)) as expected_sha256,
        coalesce(b.object_key, m.storage_key) as object_key,
        coalesce(b.storage_layout, 'legacy') as storage_layout,
        m.mime,
        (select count(*)::int from media_references r where r.media_id = m.id) as ref_count
      from media_assets m
      left join media_blobs b on b.id = m.blob_id
      order by m.created_at asc
    `,
    sql()<BlobAuditRow[]>`
      select
        b.id as blob_id, b.sha256, b.object_key, b.storage_layout, b.state,
        count(m.id)::int as asset_count
      from media_blobs b
      left join media_assets m on m.blob_id = b.id
      group by b.id
      order by b.created_at asc
    `,
    sql()<VariantAuditRow[]>`
      select id as variant_id, blob_id, object_key, sha256, state
      from media_variants
      order by created_at asc
    `,
    sql()<AliasAuditRow[]>`
      select alias_path from media_aliases order by alias_path
    `,
  ]);

  const report: any = {
    generated_at: new Date().toISOString(),
    roots: { legacy: getLegacyStorageRoot(), v2: getStorageRoot() },
    counts: {
      assets: rows.length,
      blobs: blobs.length,
      orphan_blobs: 0,
      quarantined_blobs: 0,
      orphan_verified: 0,
      orphan_missing: 0,
      orphan_corrupt: 0,
      variants: variants.length,
      variants_verified: 0,
      variants_missing: 0,
      variants_corrupt: 0,
      active: 0,
      inactive: 0,
      referenced_assets: 0,
      verified: 0,
      missing: 0,
      active_missing: 0,
      referenced_missing: 0,
      missing_reference_links: 0,
      corrupt: 0,
      untracked_legacy: 0,
      untracked_v2: 0,
      untracked_variants: 0,
      legacy_sidecars: 0,
    },
    missing: [],
    corrupt: [],
    variant_missing: [],
    variant_corrupt: [],
    orphan_blobs: [],
    untracked: { legacy: [], v2: [], variants: [] },
  };
  const trackedLegacy = new Set<string>();
  const trackedV2 = new Set<string>();
  const trackedVariants = new Set<string>();

  // A migrated blob points at v2, but its legacy alias remains an intentional
  // read-only source copy. Treat every valid alias path as tracked so the
  // post-migration audit does not misclassify preserved originals as unknown.
  for (const alias of aliases) {
    try {
      trackedLegacy.add(normalizeStorageKey(alias.alias_path));
    } catch {
      // Invalid aliases cannot correspond to a safe filesystem key and are
      // therefore intentionally not allowed to hide untracked files.
    }
  }

  for (const blob of blobs) {
    if (blob.storage_layout === "legacy") trackedLegacy.add(blob.object_key);
    else trackedV2.add(blob.object_key);
    if (blob.state === "quarantined") report.counts.quarantined_blobs++;
    if (blob.asset_count === 0) {
      report.counts.orphan_blobs++;
      report.orphan_blobs.push(blob);
      const object = await readFile(blob.object_key, blob.storage_layout);
      if (!object) {
        report.counts.orphan_missing++;
        report.missing.push({ kind: "orphan_blob", ...blob, reason: "FILE_NOT_FOUND" });
      } else {
        const actual = sha256(object.buffer);
        if (actual !== blob.sha256) {
          report.counts.orphan_corrupt++;
          report.corrupt.push({ kind: "orphan_blob", ...blob, actual_sha256: actual, actual_size: object.size });
        } else {
          report.counts.orphan_verified++;
        }
      }
    }
  }

  for (const row of rows) {
    if (row.storage_layout === "legacy") trackedLegacy.add(row.object_key);
    else trackedV2.add(row.object_key);
    if (row.status === "active") report.counts.active++;
    else report.counts.inactive++;
    if (row.ref_count > 0) report.counts.referenced_assets++;
    const object = await readFile(row.object_key, row.storage_layout);
    if (!object) {
      report.counts.missing++;
      if (row.status === "active") report.counts.active_missing++;
      if (row.ref_count > 0) {
        report.counts.referenced_missing++;
        report.counts.missing_reference_links += row.ref_count;
      }
      report.missing.push({ ...row, reason: "FILE_NOT_FOUND" });
      continue;
    }
    const actual = sha256(object.buffer);
    if (actual !== row.expected_sha256) {
      report.counts.corrupt++;
      report.corrupt.push({ ...row, actual_sha256: actual, actual_size: object.size });
      continue;
    }
    report.counts.verified++;
  }

  for (const variant of variants) {
    trackedVariants.add(variant.object_key);
    const object = await readFile(variant.object_key, "v2");
    if (!object) {
      report.counts.variants_missing++;
      report.variant_missing.push({ ...variant, reason: "FILE_NOT_FOUND" });
      continue;
    }
    const actual = sha256(object.buffer);
    if (actual !== variant.sha256) {
      report.counts.variants_corrupt++;
      report.variant_corrupt.push({ ...variant, actual_sha256: actual, actual_size: object.size });
      continue;
    }
    report.counts.variants_verified++;
  }

  const [legacyFiles, v2Files] = await Promise.all([walk(getLegacyStorageRoot()), walk(getStorageRoot())]);
  for (const key of legacyFiles) {
    if (/\.w\d+\.webp$/i.test(key)) {
      report.counts.legacy_sidecars++;
      continue;
    }
    if (!trackedLegacy.has(key)) report.untracked.legacy.push(key);
  }
  for (const key of v2Files) {
    if (/^\.backup-last-success(?:\.|$)/.test(key)) continue;
    if (key.startsWith("staging/")) continue;
    if (key.startsWith("derivatives/")) {
      if (!trackedVariants.has(key)) report.untracked.variants.push(key);
      continue;
    }
    if (!trackedV2.has(key)) report.untracked.v2.push(key);
  }
  report.counts.untracked_legacy = report.untracked.legacy.length;
  report.counts.untracked_v2 = report.untracked.v2.length;
  report.counts.untracked_variants = report.untracked.variants.length;

  const json = JSON.stringify(report, null, 2) + "\n";
  if (outputPath) {
    await fs.mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
    await fs.writeFile(outputPath, json, { encoding: "utf8", mode: 0o600 });
  }
  process.stdout.write(json);
  await sql().end();
  if (
    report.counts.missing ||
    report.counts.corrupt ||
    report.counts.orphan_missing ||
    report.counts.orphan_corrupt ||
    report.counts.variants_missing ||
    report.counts.variants_corrupt
  ) process.exitCode = 2;
}

if (import.meta.main) {
  main().catch(async (error) => {
    console.error(error);
    await sql().end().catch(() => undefined);
    process.exit(1);
  });
}
