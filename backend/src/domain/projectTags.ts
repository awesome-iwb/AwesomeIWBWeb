import { parseGithubRepoUrl } from "./urlSafety";

const MAX_RELEASES = 10;
const MAX_RELEASE_TAG_CHARS = 160;
const MAX_RELEASE_BODY_CHARS = 4000;

function boundedSingleLineText(value: unknown, maxChars: number): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || /[\x00-\x1f\x7f]/.test(text)) return "";
  return text.slice(0, maxChars);
}

function boundedMultilineText(value: unknown, maxChars: number): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text)) return "";
  return text.slice(0, maxChars);
}

function normalizeReleaseDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function normalizeReleaseUrl(value: unknown, tagName: string): string {
  const ref = parseGithubRepoUrl(value);
  if (!ref || !tagName) return "";
  return `https://github.com/${ref.owner}/${ref.repo}/releases/tag/${encodeURIComponent(tagName)}`;
}

function normalizeReleaseRows(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  return value
    .slice(0, MAX_RELEASES)
    .map((item) => {
      const tagName = boundedSingleLineText((item as any)?.tag_name, MAX_RELEASE_TAG_CHARS);
      if (!tagName) return null;
      return {
        tag_name: tagName,
        published_at: normalizeReleaseDate((item as any)?.published_at),
        body: boundedMultilineText((item as any)?.body, MAX_RELEASE_BODY_CHARS),
        html_url: normalizeReleaseUrl((item as any)?.html_url, tagName),
      };
    })
    .filter((item): item is { tag_name: string; published_at: string | null; body: string; html_url: string } => Boolean(item));
}

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
  const releases = normalizeReleaseRows(Array.isArray(project?.releases) ? project.releases : project?.extra?.releases);
  const relations = Array.isArray(project?.relations)
    ? project.relations
    : Array.isArray(project?.extra?.relations)
      ? project.extra.relations
      : undefined;
  const reviews = Array.isArray(project?.reviews)
    ? project.reviews
    : Array.isArray(project?.extra?.reviews)
      ? project.extra.reviews
      : undefined;

  return {
    ...project,
    keywords,
    ...(releases !== undefined ? { releases } : {}),
    ...(relations !== undefined ? { relations } : {}),
    ...(reviews !== undefined ? { reviews } : {}),
  } as T;
}
