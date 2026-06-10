import fs from "fs/promises";
import path from "path";
import { migrate } from "../db/migrate";
import { normalizeProjectInput } from "../domain/normalizeProjectInput";
import { upsertCategoryByName, upsertProjectBySlugOrName } from "../services/projects";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  await migrate();

  const runtimeDataPath = path.join(import.meta.dir, "../../runtime/data.json");
  let data: { categories?: Array<{ name?: string; description?: string; projects?: any[] }> } = { categories: [] };
  try {
    const content = await fs.readFile(runtimeDataPath, "utf-8");
    data = JSON.parse(content);
  } catch (error) {
    if ((error as any)?.code === "ENOENT") {
      console.log("runtime/data.json not found, skip");
      return;
    }
    throw error;
  }

  let categories = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const category of data.categories ?? []) {
    const normalizedName = String(category.name ?? "").trim();
    if (!normalizedName) continue;

    const upserted = await upsertCategoryByName({
      name: normalizedName,
      description: category.description ?? "",
    });
    categories += 1;

    for (const project of category.projects ?? []) {
      const normalized = normalizeProjectInput({
        ...project,
        category_id: upserted.id,
      });

      if (!normalized.name) {
        skipped += 1;
        continue;
      }

      const result = await upsertProjectBySlugOrName(normalized as any);
      if (result.action === "created") created += 1;
      if (result.action === "updated") updated += 1;
    }
  }

  console.log(`migrate-runtime-to-pg done: categories=${categories}, created=${created}, updated=${updated}, skipped=${skipped}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
