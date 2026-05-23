/**
 * One-off: import backend/stories/* into articles table.
 * Run after migration 0034: bun run src/scripts/import-stories-to-articles.ts
 */
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { migrate } from "../db/migrate";
import { sql } from "../db/client";
import { createArticle, getArticleBySlugAnyStatus, normalizeArticleSlug } from "../services/articles";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORIES_DIR = path.join(__dirname, "../../stories");

async function main() {
  await migrate();
  const dirs = await fs.readdir(STORIES_DIR).catch(() => [] as string[]);

  for (const dir of dirs) {
    const dirPath = path.join(STORIES_DIR, dir);
    const stat = await fs.stat(dirPath).catch(() => null);
    if (!stat?.isDirectory()) continue;

    const metaPath = path.join(dirPath, "meta.json");
    const mdPath = path.join(dirPath, "content.md");
    try {
      const meta = JSON.parse(await fs.readFile(metaPath, "utf-8"));
      const content = await fs.readFile(mdPath, "utf-8");
      const slug = normalizeArticleSlug(meta.slug ?? meta.id ?? dir);
      if (await getArticleBySlugAnyStatus(slug)) {
        console.log(`skip existing slug=${slug}`);
        continue;
      }
      await createArticle({
        slug,
        title: meta.title ?? "",
        subtitle: meta.subtitle ?? "",
        category: meta.category ?? "",
        layout_type: "hero",
        content_format: "markdown",
        content,
        cover_image: meta.coverImage ?? meta.cover ?? "",
        theme: meta.theme === "light" ? "light" : "dark",
        projects: meta.projects ?? [],
        status: "published",
        sort_index: 10,
        published_at: new Date().toISOString(),
      });
      console.log(`imported slug=${slug}`);
    } catch (e) {
      console.error(`failed ${dir}:`, e);
    }
  }

  const [{ count }] = await sql()<Array<{ count: string }>>`select count(*)::text as count from articles`;
  console.log(`articles count=${count}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
