import { appConfig } from "../config";

export type GithubRepoRef = { owner: string; repo: string };

const GITHUB_OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const GITHUB_REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;
const RESERVED_GITHUB_OWNERS = new Set([
  "about",
  "apps",
  "blog",
  "codespaces",
  "contact",
  "customer-stories",
  "dashboard",
  "enterprise",
  "events",
  "explore",
  "features",
  "issues",
  "join",
  "login",
  "marketplace",
  "new",
  "notifications",
  "organizations",
  "orgs",
  "pricing",
  "pulls",
  "search",
  "security",
  "settings",
  "sponsors",
  "topics",
  "trending",
]);

export function parseGithubRepoUrl(value: unknown): GithubRepoRef | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.hostname !== "github.com") return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/i, "");
    if (RESERVED_GITHUB_OWNERS.has(owner.toLowerCase())) return null;
    if (!GITHUB_OWNER_RE.test(owner) || !GITHUB_REPO_RE.test(repo)) return null;
    if (repo === "." || repo === "..") return null;
    if (repo.endsWith(".git")) return null;
    return { owner, repo };
  } catch {
    return null;
  }
}

export function normalizeGithubRepoUrl(value: unknown): string {
  const ref = parseGithubRepoUrl(value);
  return ref ? `https://github.com/${ref.owner}/${ref.repo}` : "";
}

export function normalizeInternalUploadUrl(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const prefix = appConfig.storage.publicPrefix || "/api/uploads";
  if (!raw.startsWith(`${prefix}/`)) return "";
  if (raw.includes("?") || raw.includes("#")) return "";
  try {
    const url = new URL(raw, "https://local.invalid");
    if (url.origin !== "https://local.invalid") return "";
    if (url.pathname !== raw) return "";
    const suffix = raw.slice(prefix.length + 1);
    if (!suffix || suffix.includes("\\") || suffix.split("/").some((part) => !part || part === "." || part === "..")) {
      return "";
    }
    return raw;
  } catch {
    return "";
  }
}

export function normalizePublicWebsiteUrl(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    if (!url.hostname || url.username || url.password) return "";
    return url.toString();
  } catch {
    return "";
  }
}
