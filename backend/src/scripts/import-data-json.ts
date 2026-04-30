import data from "../data.json";
import { migrate } from "../db/migrate";
import { sql } from "../db/client";
import { newSlug } from "../utils/slug";

await migrate();

const categoryIdByName = new Map<string, string>();

for (let i = 0; i < data.categories.length; i++) {
  const c: any = data.categories[i];
  const [row] = await sql()<Array<{ id: string }>>`
    insert into categories (name, description, sort_index)
    values (${c.name}, ${c.description ?? ""}, ${i})
    returning id
  `;
  categoryIdByName.set(c.name, row.id);
}

for (const c of data.categories as any[]) {
  const categoryId = categoryIdByName.get(c.name) ?? null;
  for (const p of c.projects as any[]) {
    const slug = newSlug();
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
      on conflict (slug) do nothing
    `;
  }
}

console.log("import done");
