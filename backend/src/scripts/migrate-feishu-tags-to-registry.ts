/**
 * One-off: import keywords / feishu project_state_tags into tag_definitions + project_tag_links.
 * bun run src/scripts/migrate-feishu-tags-to-registry.ts
 */
import { migrate } from "../db/migrate";
import { sql } from "../db/client";
import { findOrCreateTagByLabel, getTagsForProject, setProjectTags } from "../services/tags";
import { normalizeProjectTags } from "../domain/projectTags";

async function main() {
  await migrate();
  const projects = await sql()<Array<{ id: string; keywords: string[]; extra: any }>>`
    select id, keywords, extra from projects
  `;

  let linked = 0;
  for (const p of projects) {
    const normalized = normalizeProjectTags(p);
    const stateTags = Array.isArray(p.extra?.feishu?.project_state_tags) ? p.extra.feishu.project_state_tags : [];
    const keywords = Array.isArray(normalized.keywords) ? normalized.keywords : [];
    const labels = new Set<string>();
    for (const t of [...stateTags, ...keywords]) {
      const s = String(t).trim();
      if (s) labels.add(s);
    }

    const tagIds: string[] = [];
    for (const label of labels) {
      const group =
        label.includes("稳定") || label.includes("画饼") || label.includes("停更") || label.includes("活跃")
          ? "state"
          : "feature";
      const tag = await findOrCreateTagByLabel(label, group as any, {
        show_in_gallery: true,
        show_on_card: group === "state",
        card_priority: group === "state" ? 5 : 0,
      });
      if (tag) tagIds.push(tag.id);
    }

    if (tagIds.length) {
      const existing = await getTagsForProject(p.id);
      const merged = [...new Set([...existing.map((t) => t.id), ...tagIds])];
      await setProjectTags(p.id, merged);
      linked++;
    }
  }

  const [{ count }] = await sql()<Array<{ count: string }>>`select count(*)::text as count from tag_definitions`;
  console.log(`projects linked=${linked}, tag_definitions=${count}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
