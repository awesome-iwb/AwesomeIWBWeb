import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { createArticle, getArticleBySlugAnyStatus, normalizeArticleSlug } from "./articles";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORIES_DIR = path.join(__dirname, "../../stories");

export async function importStoriesFromFilesIfEmpty() {
  const { sql } = await import("../db/client");
  const [{ count }] = await sql()<Array<{ count: string }>>`select count(*)::text as count from articles`;
  if (Number(count) > 0) return { imported: 0, skipped: true };

  let imported = 0;
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
      if (await getArticleBySlugAnyStatus(slug)) continue;
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
      imported++;
    } catch {
      /* skip broken story dirs */
    }
  }
  return { imported, skipped: false };
}
