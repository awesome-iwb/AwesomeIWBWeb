import fs from "fs/promises";
import path from "path";
import { sql } from "../db/client";
import { normalizeInternalUploadUrl } from "../domain/urlSafety";
import { buildArticleMediaFields } from "../services/articles";
import { syncMediaReferencesForEntity } from "../services/media";

const APPLY = process.argv.includes("--apply");
const REF_TYPE = "usage";
const STORIES_DIR = path.join(import.meta.dir, "../../stories");

type Stats = { scanned: number; resolved: number; skipped: number; errors: number };

function createStats(): Stats {
  return { scanned: 0, resolved: 0, skipped: 0, errors: 0 };
}

function addStats(target: Stats, source: Stats): void {
  target.scanned += source.scanned;
  target.resolved += source.resolved;
  target.skipped += source.skipped;
  target.errors += source.errors;
}

function printStats(label: string, stats: Stats): void {
  console.log(
    `${label}: scanned=${stats.scanned} resolved=${stats.resolved} skipped=${stats.skipped} errors=${stats.errors}`,
  );
}

async function syncEntity(
  stats: Stats,
  entityType: string,
  entityId: string,
  fields: Array<{ url: string; fieldPath: string }>,
): Promise<void> {
  stats.scanned++;
  if (!fields.length) stats.skipped++;
  if (!APPLY) {
    stats.resolved += fields.length;
    return;
  }
  try {
    const count = await syncMediaReferencesForEntity({
      entityType,
      entityId,
      fields,
      refType: REF_TYPE,
    });
    stats.resolved += count;
    stats.skipped += Math.max(0, fields.length - count);
  } catch (error) {
    stats.errors++;
    console.error(`[media refs] ${entityType}:${entityId} failed`, error);
  }
}

function buildProjectMediaFields(project: {
  icon?: string | null;
  banner?: string | null;
  avatar?: string | null;
  extra?: unknown;
}): Array<{ url: string; fieldPath: string }> {
  const fields: Array<{ url: string; fieldPath: string }> = [];
  if (project.icon) fields.push({ url: project.icon, fieldPath: "icon" });
  if (project.banner) fields.push({ url: project.banner, fieldPath: "banner" });
  if (project.avatar) fields.push({ url: project.avatar, fieldPath: "avatar" });

  const visit = (value: unknown, pathParts: string[]) => {
    if (typeof value === "string") {
      const url = normalizeInternalUploadUrl(value);
      if (url) fields.push({ url, fieldPath: pathParts.join(".") });
      return;
    }
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, [...pathParts, String(index)]));
      return;
    }
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      visit(child, [...pathParts, key]);
    }
  };
  visit(project.extra, ["extra"]);
  return fields;
}

async function backfillProjects(): Promise<Stats> {
  const stats = createStats();
  const rows = await sql()<Array<{
    id: string;
    icon: string;
    banner: string;
    avatar: string;
    extra: unknown;
  }>>`select id, icon, banner, avatar, extra from projects`;
  for (const row of rows) {
    await syncEntity(stats, "project", row.id, buildProjectMediaFields(row));
  }
  return stats;
}

async function backfillArticles(): Promise<Stats> {
  const stats = createStats();
  const rows = await sql()<Array<{ id: string; cover_image: string; content: string }>>`
    select id, cover_image, content from articles
  `;
  for (const row of rows) {
    await syncEntity(stats, "article", row.id, buildArticleMediaFields(row));
  }
  return stats;
}

async function backfillUsers(): Promise<Stats> {
  const stats = createStats();
  const rows = await sql()<Array<{ id: string; avatar_url: string }>>`select id, avatar_url from users`;
  for (const row of rows) {
    const fields = row.avatar_url ? [{ url: row.avatar_url, fieldPath: "avatar_url" }] : [];
    await syncEntity(stats, "user", row.id, fields);
  }
  return stats;
}

async function backfillOrganizations(): Promise<Stats> {
  const stats = createStats();
  const rows = await sql()<Array<{ id: string; avatar_url: string }>>`select id, avatar_url from organizations`;
  for (const row of rows) {
    const fields = row.avatar_url ? [{ url: row.avatar_url, fieldPath: "avatar_url" }] : [];
    await syncEntity(stats, "organization", row.id, fields);
  }
  return stats;
}

async function backfillStories(): Promise<Stats> {
  const stats = createStats();
  let entries;
  try {
    entries = await fs.readdir(STORIES_DIR, { withFileTypes: true });
  } catch (error: any) {
    if (error?.code === "ENOENT") return stats;
    throw error;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const raw = await fs.readFile(path.join(STORIES_DIR, entry.name, "meta.json"), "utf8");
      const meta = JSON.parse(raw) as Record<string, unknown>;
      const cover = String(meta.cover ?? meta.coverImage ?? "").trim();
      await syncEntity(stats, "story", entry.name, cover ? [{ url: cover, fieldPath: "cover" }] : []);
    } catch (error) {
      stats.errors++;
      console.error(`[media refs] story:${entry.name} failed`, error);
    }
  }
  return stats;
}

async function removeHistoricalBackfillReferences(): Promise<number> {
  const result = await sql()`delete from media_references where ref_type = 'backfill'`;
  const value = result as unknown as { count?: number; rowCount?: number };
  return Number(value.count ?? value.rowCount ?? 0) || 0;
}

async function removeStaleUsageReferences(): Promise<number> {
  const result = await sql()`
    delete from media_references r
    where r.ref_type = 'usage' and (
      (r.entity_type = 'project' and not exists (select 1 from projects p where p.id::text = r.entity_id))
      or (r.entity_type = 'article' and not exists (select 1 from articles a where a.id::text = r.entity_id))
      or (r.entity_type = 'user' and not exists (select 1 from users u where u.id::text = r.entity_id))
      or (r.entity_type = 'organization' and not exists (select 1 from organizations o where o.id::text = r.entity_id))
    )
  `;
  const value = result as unknown as { count?: number; rowCount?: number };
  return Number(value.count ?? value.rowCount ?? 0) || 0;
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  console.log(`=== media reference backfill ${APPLY ? "(APPLY)" : "(dry-run)"} ===`);
  if (!APPLY) console.log("No rows will be changed. Pass --apply to write authoritative usage references.");

  const total = createStats();
  const groups: Array<[string, () => Promise<Stats>]> = [
    ["projects", backfillProjects],
    ["articles", backfillArticles],
    ["users", backfillUsers],
    ["organizations", backfillOrganizations],
    ["stories", backfillStories],
  ];
  for (const [label, run] of groups) {
    const stats = await run();
    printStats(label, stats);
    addStats(total, stats);
  }

  let removedBackfillRefs = 0;
  let removedStaleUsageRefs = 0;
  if (APPLY) {
    if (total.errors) {
      throw new Error(`MEDIA_REFERENCE_BACKFILL_INCOMPLETE:${total.errors}`);
    }
    removedBackfillRefs = await removeHistoricalBackfillReferences();
    removedStaleUsageRefs = await removeStaleUsageReferences();
  }
  printStats("total", total);
  console.log(JSON.stringify({ apply: APPLY, removedBackfillRefs, removedStaleUsageRefs, ...total }, null, 2));
}

main()
  .catch((error) => {
    console.error("media reference backfill failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql().end().catch(() => undefined);
  });
