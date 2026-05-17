import { sql } from "../db/client";
import { upsertMediaReferencesForEntity } from "../services/media";
import fs from "fs/promises";
import path from "path";

const DRY_RUN = process.argv.includes("--dry-run");
const REF_TYPE = "backfill";

const STORIES_DIR = path.join(import.meta.dir, "../../stories");

type Stats = {
  scanned: number;
  inserted: number;
  skipped: number;
  errors: number;
};

function createStats(): Stats {
  return { scanned: 0, inserted: 0, skipped: 0, errors: 0 };
}

function printStats(label: string, stats: Stats) {
  console.log(
    `  [${label}] 扫描: ${stats.scanned}, 新增: ${stats.inserted}, 跳过: ${stats.skipped}, 错误: ${stats.errors}`,
  );
}

async function backfillProjects(): Promise<Stats> {
  const stats = createStats();
  const rows = await sql()<
    Array<{ id: string; icon: string; banner: string; avatar: string }>
  >`select id, icon, banner, avatar from projects`;

  for (const row of rows) {
    stats.scanned++;
    const fields: Array<{ url: string; fieldPath: string }> = [];
    if (row.icon) fields.push({ url: row.icon, fieldPath: "icon" });
    if (row.banner) fields.push({ url: row.banner, fieldPath: "banner" });
    if (row.avatar) fields.push({ url: row.avatar, fieldPath: "avatar" });

    if (fields.length === 0) {
      stats.skipped++;
      continue;
    }

    if (DRY_RUN) {
      const nonEmpty = fields.filter((f) => f.url);
      stats.inserted += nonEmpty.length;
      continue;
    }

    try {
      const count = await upsertMediaReferencesForEntity({
        entityType: "project",
        entityId: row.id,
        fields,
        refType: REF_TYPE,
      });
      stats.inserted += count;
      stats.skipped += fields.length - count;
    } catch (e) {
      stats.errors++;
      console.error(`  项目 ${row.id} 回填失败:`, e);
    }
  }

  return stats;
}

async function backfillUsers(): Promise<Stats> {
  const stats = createStats();
  const rows = await sql()<
    Array<{ id: string; avatar_url: string }>
  >`select id, avatar_url from users`;

  for (const row of rows) {
    stats.scanned++;
    if (!row.avatar_url) {
      stats.skipped++;
      continue;
    }

    const fields = [{ url: row.avatar_url, fieldPath: "avatar_url" }];

    if (DRY_RUN) {
      stats.inserted++;
      continue;
    }

    try {
      const count = await upsertMediaReferencesForEntity({
        entityType: "user",
        entityId: row.id,
        fields,
        refType: REF_TYPE,
      });
      stats.inserted += count;
      stats.skipped += 1 - count;
    } catch (e) {
      stats.errors++;
      console.error(`  用户 ${row.id} 回填失败:`, e);
    }
  }

  return stats;
}

async function backfillStories(): Promise<Stats> {
  const stats = createStats();
  let dirs: string[];
  try {
    dirs = await fs.readdir(STORIES_DIR);
  } catch {
    console.log("  故事目录不存在，跳过");
    return stats;
  }

  for (const dir of dirs) {
    const metaPath = path.join(STORIES_DIR, dir, "meta.json");
    let meta: Record<string, any>;
    try {
      const stat = await fs.stat(path.join(STORIES_DIR, dir));
      if (!stat.isDirectory()) continue;
      const content = await fs.readFile(metaPath, "utf-8");
      meta = JSON.parse(content);
    } catch {
      stats.errors++;
      continue;
    }

    stats.scanned++;
    const coverUrl = meta.cover || meta.coverImage || "";
    if (!coverUrl) {
      stats.skipped++;
      continue;
    }

    const fields = [{ url: coverUrl, fieldPath: "cover" }];

    if (DRY_RUN) {
      stats.inserted++;
      continue;
    }

    try {
      const count = await upsertMediaReferencesForEntity({
        entityType: "story",
        entityId: dir,
        fields,
        refType: REF_TYPE,
      });
      stats.inserted += count;
      stats.skipped += 1 - count;
    } catch (e) {
      stats.errors++;
      console.error(`  故事 ${dir} 回填失败:`, e);
    }
  }

  return stats;
}

async function main() {
  console.log(`=== 媒体引用回填 ${DRY_RUN ? "(dry-run)" : ""} ===\n`);

  const totalStats = createStats();

  console.log("1. 回填项目引用 (icon/banner/avatar)...");
  const projectStats = await backfillProjects();
  printStats("项目", projectStats);

  console.log("\n2. 回填用户头像引用 (avatar_url)...");
  const userStats = await backfillUsers();
  printStats("用户", userStats);

  console.log("\n3. 回填故事封面引用 (cover)...");
  const storyStats = await backfillStories();
  printStats("故事", storyStats);

  for (const s of [projectStats, userStats, storyStats]) {
    totalStats.scanned += s.scanned;
    totalStats.inserted += s.inserted;
    totalStats.skipped += s.skipped;
    totalStats.errors += s.errors;
  }

  console.log("\n=== 汇总 ===");
  printStats("总计", totalStats);

  if (DRY_RUN) {
    console.log("\n(dry-run 模式，未实际写入数据)");
  }

  await sql().end();
}

main().catch((e) => {
  console.error("回填脚本执行失败:", e);
  process.exit(1);
});
