import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { migrate } from "../db/migrate";
import { sql } from "../db/client";
import { projectKeyFrom } from "../domain/projectKey";

type ProjectLike = {
  slug?: string;
  name?: string;
  github_url?: string;
  developer?: string;
  status?: string;
  version?: string;
  description?: string;
  keywords?: string[];
  recommendation?: string;
  avatar?: string;
  icon?: string;
  banner?: string;
  stars?: number;
  language?: string;
  last_update?: string | null;
  github_is_fork?: boolean;
  github_parent_url?: string;
  github_source_url?: string;
};

type CategoryLike = { name?: string; description?: string; projects?: ProjectLike[] };
type DataLike = { categories?: CategoryLike[] };

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const dataCandidates = [
  path.resolve(scriptDir, "../../runtime/data.json"),
  path.resolve(scriptDir, "../data.json")
];

const dataPath = dataCandidates.find((p) => fs.existsSync(p));
if (!dataPath) {
  throw new Error(`No data source found. Tried: ${dataCandidates.join(", ")}`);
}

const raw = fs.readFileSync(dataPath, "utf8");
const data = JSON.parse(raw) as DataLike;
const categories = Array.isArray(data.categories) ? data.categories : [];

const stableSlug = (categoryName: string, p: ProjectLike, name: string) => {
  const base = projectKeyFrom({
    slug: typeof p?.slug === "string" ? p.slug : undefined,
    name,
    github_url: typeof p?.github_url === "string" ? p.github_url : undefined
  });
  const fingerprint = [
    categoryName.trim().toLowerCase(),
    name.trim().toLowerCase(),
    String(p.github_url ?? "").trim().toLowerCase()
  ].join("|");
  const hash = crypto.createHash("sha1").update(fingerprint).digest("hex").slice(0, 10);
  return `${base}-${hash}`;
};

await migrate();

const categoryIdByName = new Map<string, string>();

for (let i = 0; i < categories.length; i++) {
  const c = categories[i] as CategoryLike;
  if (!String(c?.name ?? "").trim()) {
    console.error(`[skip][category] index=${i} because name is empty`);
    continue;
  }
  const [row] = await sql()<Array<{ id: string }>>`
    with updated as (
      update categories
      set description = ${c.description ?? ""},
          sort_index = ${i},
          updated_at = now()
      where lower(name) = lower(${c.name})
      returning id
    ), inserted as (
      insert into categories (name, description, sort_index)
      select ${c.name}, ${c.description ?? ""}, ${i}
      where not exists (select 1 from updated)
      returning id
    )
    select id from updated
    union all
    select id from inserted
    limit 1
  `;
  categoryIdByName.set(String(c.name), row.id);
}

let importedProjects = 0;
let skippedProjects = 0;

for (const c of categories) {
  const categoryName = String(c?.name ?? "");
  const categoryId = categoryIdByName.get(categoryName) ?? null;
  if (!categoryId) {
    console.error(`[skip][category] "${categoryName}" because category id not found after upsert`);
    continue;
  }
  const projects = Array.isArray(c.projects) ? c.projects : [];
  for (const p of projects) {
    const name = String(p?.name ?? "").trim();
    if (!name) {
      skippedProjects += 1;
      console.error(`[skip][project] category="${categoryName}" because name is empty`);
      continue;
    }

    const slug = stableSlug(categoryName, p, name);

    await sql()`
      insert into projects (slug, name, category_id, developer, status, version, description, keywords, recommendation, github_url, avatar, icon, banner, stars, language, last_update, github_is_fork, github_parent_url, github_source_url, extra)
      values (
        ${slug},
        ${p.name ?? ""},
        ${categoryId},
        ${p.developer ?? ""},
        ${p.status ?? ""},
        ${p.version ?? ""},
        ${p.description ?? ""},
        ${p.keywords ?? []},
        ${p.recommendation ? [p.recommendation] : []},
        ${p.github_url ?? ""},
        ${p.avatar ?? ""},
        ${p.icon ?? p.avatar ?? ""},
        ${p.banner ?? ""},
        ${p.stars ?? 0},
        ${p.language ?? ""},
        ${p.last_update ?? null},
        ${p.github_is_fork ?? false},
        ${p.github_parent_url ?? ""},
        ${p.github_source_url ?? ""},
        ${p}
      )
      on conflict (slug) do update set
        name = excluded.name,
        category_id = excluded.category_id,
        developer = excluded.developer,
        status = excluded.status,
        version = excluded.version,
        description = excluded.description,
        keywords = excluded.keywords,
        recommendation = excluded.recommendation,
        github_url = excluded.github_url,
        avatar = excluded.avatar,
        icon = excluded.icon,
        banner = excluded.banner,
        stars = excluded.stars,
        language = excluded.language,
        last_update = excluded.last_update,
        github_is_fork = excluded.github_is_fork,
        github_parent_url = excluded.github_parent_url,
        github_source_url = excluded.github_source_url,
        extra = excluded.extra,
        updated_at = now()
    `;
    importedProjects += 1;
  }
}

console.log(`import source: ${dataPath}`);
console.log(`import done: projects=${importedProjects}, skipped=${skippedProjects}, categories=${categoryIdByName.size}`);
