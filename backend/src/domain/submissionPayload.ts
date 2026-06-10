import { normalizeGithubRepoUrl, normalizeInternalUploadUrl } from "./urlSafety";

const MAX_TEXT = {
  name: 120,
  developer: 120,
  github_url: 300,
  description: 5000,
  keywords: 1000,
  category: 160,
  ai_usage_state: 20,
  icon: 500,
  banner: 500,
};

const ALLOWED_AI_USAGE = new Set(["unknown", "under50", "over50"]);

function trimString(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function normalizeMediaUrl(value: unknown, max: number): string {
  const raw = trimString(value, max);
  return normalizeInternalUploadUrl(raw);
}

function normalizeGithubUrl(value: unknown): string {
  const raw = trimString(value, MAX_TEXT.github_url);
  return normalizeGithubRepoUrl(raw);
}

export type NormalizedProjectSubmissionPayload = {
  name: string;
  developer: string;
  github_url: string;
  description: string;
  keywords: string;
  category: string;
  ai_usage_state: "unknown" | "under50" | "over50";
  icon?: string;
  banner?: string;
};

export function normalizeProjectSubmissionPayload(input: unknown): NormalizedProjectSubmissionPayload {
  const raw = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const aiUsage = trimString(raw.ai_usage_state, MAX_TEXT.ai_usage_state);
  const payload: NormalizedProjectSubmissionPayload = {
    name: trimString(raw.name, MAX_TEXT.name),
    developer: trimString(raw.developer, MAX_TEXT.developer),
    github_url: normalizeGithubUrl(raw.github_url ?? raw.githubUrl),
    description: trimString(raw.description, MAX_TEXT.description),
    keywords: trimString(raw.keywords ?? raw.tags, MAX_TEXT.keywords),
    category: trimString(raw.category, MAX_TEXT.category),
    ai_usage_state: ALLOWED_AI_USAGE.has(aiUsage) ? aiUsage as NormalizedProjectSubmissionPayload["ai_usage_state"] : "unknown",
  };

  const icon = normalizeMediaUrl(raw.icon ?? raw.icon_url, MAX_TEXT.icon);
  if (icon) payload.icon = icon;

  const banner = normalizeMediaUrl(raw.banner ?? raw.banner_url, MAX_TEXT.banner);
  if (banner) payload.banner = banner;

  return payload;
}

export function validateProjectSubmissionPayload(payload: NormalizedProjectSubmissionPayload): string | null {
  if (!payload.name || !payload.developer || !payload.github_url) {
    return "name, developer, github_url are required";
  }
  return null;
}
