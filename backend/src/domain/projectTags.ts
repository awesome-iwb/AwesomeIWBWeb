export function normalizeProjectTags<T extends Record<string, any>>(project: T): T {
  const tech = Array.isArray(project?.extra?.feishu?.tech_stack) ? project.extra.feishu.tech_stack : [];
  const stateTags = Array.isArray(project?.extra?.feishu?.project_state_tags) ? project.extra.feishu.project_state_tags : [];
  const techSet = new Set(tech.map((x: any) => String(x).trim()).filter(Boolean));

  const base = stateTags.map((x: any) => String(x).trim()).filter(Boolean);
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const t of base) {
    if (techSet.has(t)) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    merged.push(t);
  }

  const keywords = merged;

  return { ...project, keywords } as T;
}
