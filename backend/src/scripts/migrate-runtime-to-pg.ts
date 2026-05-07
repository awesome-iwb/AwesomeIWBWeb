import fs from "fs/promises";
import path from "path";
import { migrate } from "../db/migrate";
import { upsertCategoryByName, upsertProjectBySlugOrName } from "../services/projects";
import { normalizeProjectInput } from "../domain/normalizeProjectInput";

const runtimePath = path.join(import.meta.dir, "../../runtime/data.json");

await migrate();

let raw: any = { categories: [] };
try {
  raw = JSON.parse(await fs.readFile(runtimePath, "utf-8"));
} catch {
  console.log("runtime/data.json not found, skip");
  process.exit(0);
}

let created = 0;
let updated = 0;
for (const c of raw.categories ?? []) {
  if (!c?.name) continue;
  const { id: categoryId } = await upsertCategoryByName({ name: c.name, description: c.description ?? "" });
  for (const p of c.projects ?? []) {
    if (!p?.name) continue;
    const normalized = normalizeProjectInput({ ...p, category_id: categoryId });
    const res = await upsertProjectBySlugOrName(normalized as any);
    if (res.action === "created") created += 1;
    if (res.action === "updated") updated += 1;
  }
}

console.log(`runtime -> pg done. created=${created} updated=${updated}`);
import fs from "fs/promises";
import path from "path";
import { migrate } from "../db/migrate";
import { upsertCategoryByName, upsertProjectBySlugOrName } from "../services/projects";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }
  await migrate();
  const runtimeDataPath = path.join(import.meta.dir, "../../runtime/data.json");
  const content = await fs.readFile(runtimeDataPath, "utf-8");
  const data = JSON.parse(content) as { categories?: Array<{ name: string; description?: string; projects?: any[] }> };
  let categories = 0;
  let projects = 0;
  for (const category of data.categories ?? []) {
    const normalizedName = String(category.name ?? "").trim();
    if (!normalizedName) continue;
    const upserted = await upsertCategoryByName({ name: normalizedName, description: category.description ?? "" });
    categories += 1;
    for (const project of category.projects ?? []) {
      await upsertProjectBySlugOrName({
        ...project,
        category_id: upserted.id
      } as any);
      projects += 1;
    }
  }
  console.log(`migrate-runtime-to-pg done: categories=${categories}, projects=${projects}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
