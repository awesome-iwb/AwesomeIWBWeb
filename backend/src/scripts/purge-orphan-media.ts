import { sql } from "../db/client";
import {
  deleteFile,
  fileExists,
  getStorageRoot,
  thumbSidecarKey,
} from "../services/storage";
import { hardDeleteMediaRecord, listPurgeCandidates } from "../services/media";
import fs from "fs/promises";
import path from "path";

const DRY_RUN = process.argv.includes("--dry-run");
const MIN_DAYS = Number(process.env.PURGE_MIN_DAYS ?? 7);

async function deleteThumbSidecars(storageKey: string): Promise<number> {
  let removed = 0;
  const dir = path.posix.dirname(storageKey);
  const base = path.posix.basename(storageKey, path.posix.extname(storageKey));
  const root = getStorageRoot();
  const parentDir = dir === "." ? root : path.join(root, dir);

  try {
    const entries = await fs.readdir(parentDir);
    for (const entry of entries) {
      if (!entry.startsWith(`${base}.w`) || !entry.endsWith(".webp")) continue;
      const key = dir === "." ? entry : `${dir}/${entry}`;
      if (DRY_RUN) {
        console.log(`  [dry-run] 删除缩略图: ${key}`);
      } else {
        await deleteFile(key);
      }
      removed++;
    }
  } catch {
    // directory may not exist
  }

  for (const width of [128, 200, 400]) {
    const key = thumbSidecarKey(storageKey, width);
    if (await fileExists(key)) {
      if (DRY_RUN) {
        console.log(`  [dry-run] 删除缩略图: ${key}`);
      } else {
        await deleteFile(key);
      }
      removed++;
    }
  }

  return removed;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  console.log(`=== 清理软删除且无引用的媒体 ${DRY_RUN ? "(dry-run)" : ""} ===`);
  console.log(`最小删除天数: ${MIN_DAYS}\n`);

  const candidates = await listPurgeCandidates(MIN_DAYS);
  let purged = 0;
  let skipped = 0;
  let errors = 0;

  for (const item of candidates) {
    if (item.ref_count > 0) {
      skipped++;
      continue;
    }

    console.log(`- ${item.id} ${item.storage_key} (deleted_at=${item.deleted_at})`);

    if (DRY_RUN) {
      purged++;
      continue;
    }

    try {
      if (item.storage_key && (await fileExists(item.storage_key))) {
        await deleteFile(item.storage_key);
      }
      await deleteThumbSidecars(item.storage_key);
      await hardDeleteMediaRecord(item.id);
      purged++;
    } catch (err) {
      errors++;
      console.error(`  清理失败 ${item.id}:`, err);
    }
  }

  console.log("\n=== 汇总 ===");
  console.log(`候选: ${candidates.length}, 已清理: ${purged}, 跳过: ${skipped}, 错误: ${errors}`);

  await sql().end();
}

main().catch((err) => {
  console.error("清理脚本失败:", err);
  process.exit(1);
});
