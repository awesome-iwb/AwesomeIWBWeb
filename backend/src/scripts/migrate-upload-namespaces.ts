import { sql } from "../db/client";
import { appConfig } from "../config";
import {
  getStorageRoot,
  moveFile,
  publicUrl,
  fileExists,
  resolveStoragePath,
} from "../services/storage";
import fs from "fs/promises";
import path from "path";

const DRY_RUN = process.argv.includes("--dry-run");

function namespaceForSource(source: string): string {
  if (source === "avatar") return "avatars";
  if (source === "project") return "projects";
  return "content";
}

async function rewriteUrlReferences(oldUrl: string, newUrl: string): Promise<void> {
  if (!oldUrl || oldUrl === newUrl) return;
  await sql()`update projects set icon = ${newUrl} where icon = ${oldUrl}`;
  await sql()`update projects set banner = ${newUrl} where banner = ${oldUrl}`;
  await sql()`update projects set avatar = ${newUrl} where avatar = ${oldUrl}`;
  await sql()`update users set avatar_url = ${newUrl} where avatar_url = ${oldUrl}`;
  await sql()`update users set upload_avatar_url = ${newUrl} where upload_avatar_url = ${oldUrl}`;
  await sql()`update users set external_avatar_url = ${newUrl} where external_avatar_url = ${oldUrl}`;
  await sql()`update organizations set avatar_url = ${newUrl} where avatar_url = ${oldUrl}`;
  await sql()`update articles set cover_image = ${newUrl} where cover_image = ${oldUrl}`;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  console.log(`=== 迁移 uploads 命名空间 ${DRY_RUN ? "(dry-run)" : ""} ===`);
  console.log(`存储根目录: ${getStorageRoot()}`);
  console.log(`公开前缀: ${appConfig.storage.publicPrefix}\n`);

  const rows = await sql()<
    Array<{ id: string; storage_key: string; url: string; source: string }>
  >`
    select id, storage_key, url, source
    from media_assets
    where storage_key not like '%/%'
    order by created_at asc
  `;

  let moved = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows) {
    const namespace = namespaceForSource(row.source);
    const filename = path.posix.basename(row.storage_key);
    const newKey = `${namespace}/${filename}`;
    const newUrl = publicUrl(newKey);

    if (newKey === row.storage_key) {
      skipped++;
      continue;
    }

    const oldPath = resolveStoragePath(row.storage_key);
    const oldExists = await fileExists(row.storage_key);
    const newExists = await fileExists(newKey);

    if (!oldExists && !newExists) {
      if (DRY_RUN) {
        console.log(`  [dry-run-db-only] ${row.storage_key} -> ${newKey} (file missing)`);
        moved++;
        continue;
      }
      await sql()`
        update media_assets
        set storage_key = ${newKey}, url = ${newUrl}
        where id = ${row.id}
      `;
      await rewriteUrlReferences(row.url, newUrl);
      moved++;
      console.warn(`  [db-only] ${row.storage_key} -> ${newKey} (file missing, ${row.id})`);
      continue;
    }

    if (DRY_RUN) {
      console.log(`  [dry-run] ${row.storage_key} -> ${newKey}`);
      moved++;
      continue;
    }

    try {
      if (oldExists && !newExists) {
        await moveFile(row.storage_key, newKey);
      } else if (!oldExists && newExists) {
        console.log(`  [info] 目标已存在，仅更新 DB: ${newKey}`);
      } else if (oldExists && newExists) {
        await fs.unlink(oldPath).catch(() => undefined);
        console.log(`  [info] 目标已存在，删除旧 flat 文件: ${row.storage_key}`);
      }

      await sql()`
        update media_assets
        set storage_key = ${newKey}, url = ${newUrl}
        where id = ${row.id}
      `;
      await rewriteUrlReferences(row.url, newUrl);
      moved++;
      console.log(`  [ok] ${row.storage_key} -> ${newKey}`);
    } catch (err) {
      errors++;
      console.error(`  [error] ${row.id}:`, err);
    }
  }

  console.log("\n=== 汇总 ===");
  console.log(`扫描: ${rows.length}, 迁移: ${moved}, 跳过: ${skipped}, 错误: ${errors}`);

  await sql().end();
}

main().catch((err) => {
  console.error("迁移失败:", err);
  process.exit(1);
});
