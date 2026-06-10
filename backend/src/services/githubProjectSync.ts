import { Octokit } from "@octokit/rest";
import { sql } from "../db/client";
import { normalizeGithubRepoUrl, parseGithubRepoUrl, type GithubRepoRef } from "../domain/urlSafety";
import { markProjectGithubSyncAttempt, updateProjectGithubMetadata, type ProjectRow } from "./projects";

export { parseGithubRepoUrl, type GithubRepoRef };

export function evaluateStatusFromPush(pushedAt: string | null | undefined): string | null {
  if (!pushedAt) return null;
  const d = new Date(pushedAt);
  if (Number.isNaN(d.getTime())) return null;
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 180) return "活跃";
  if (days <= 365) return "缓慢更新";
  return "可能停更";
}

function octokit(): Octokit {
  const token = process.env.GITHUB_TOKEN?.trim();
  return new Octokit(token ? { auth: token } : {});
}

type ReleaseRow = {
  tag_name: string;
  published_at: string | null;
  body: string;
  html_url: string;
};

type SyncableProject = Pick<ProjectRow, "id" | "github_url" | "status" | "extra">;

const MAX_RELEASE_TAG_CHARS = 160;
const MAX_RELEASE_BODY_CHARS = 4000;
const MAX_GITHUB_TEXT_CHARS = 160;

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

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeCount(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.floor(n));
}

function releaseHtmlUrl(ref: GithubRepoRef, tagName: string): string {
  return `https://github.com/${ref.owner}/${ref.repo}/releases/tag/${encodeURIComponent(tagName)}`;
}

function normalizeReleaseRow(ref: GithubRepoRef, input: {
  tag_name?: unknown;
  published_at?: unknown;
  body?: unknown;
}): ReleaseRow | null {
  const tagName = boundedSingleLineText(input.tag_name, MAX_RELEASE_TAG_CHARS);
  if (!tagName) return null;
  return {
    tag_name: tagName,
    published_at: normalizeTimestamp(input.published_at),
    body: boundedMultilineText(input.body, MAX_RELEASE_BODY_CHARS),
    html_url: releaseHtmlUrl(ref, tagName),
  };
}

function mapReleaseRows(ref: GithubRepoRef, data: Awaited<ReturnType<Octokit["repos"]["listReleases"]>>["data"]): ReleaseRow[] {
  return (data ?? [])
    .map((r) => normalizeReleaseRow(ref, {
      tag_name: r.tag_name,
      published_at: r.published_at,
      body: r.body,
    }))
    .filter((r): r is ReleaseRow => Boolean(r));
}

async function fetchRecentTags(octokitClient: Octokit, owner: string, repo: string): Promise<ReleaseRow[]> {
  const { data } = await octokitClient.repos.listTags({ owner, repo, per_page: 5 });
  const ref = { owner, repo };
  return (data ?? [])
    .map((tag) => normalizeReleaseRow(ref, {
      tag_name: tag.name,
      published_at: null,
      body: "",
    }))
    .filter((r): r is ReleaseRow => Boolean(r));
}

function sumReleaseDownloads(releases: Awaited<ReturnType<Octokit["repos"]["listReleases"]>>["data"]): number {
  let total = 0;
  for (const rel of releases ?? []) {
    for (const asset of rel.assets ?? []) {
      total += normalizeCount(asset.download_count);
    }
  }
  return Math.min(Number.MAX_SAFE_INTEGER, total);
}

export type SyncGithubProjectResult = {
  id: string;
  updated: boolean;
  skipped?: string;
  error?: string;
};

export async function syncProjectFromGithub(
  project: SyncableProject,
  opts?: { dryRun?: boolean; octokitClient?: Octokit }
): Promise<SyncGithubProjectResult> {
  const ref = parseGithubRepoUrl(project.github_url);
  if (!ref) {
    if (!opts?.dryRun) await markProjectGithubSyncAttempt(project.id, "invalid_github_url");
    return { id: project.id, updated: false, skipped: "invalid_github_url" };
  }

  const client = opts?.octokitClient ?? octokit();
  try {
    const [{ data }, releaseResult] = await Promise.all([
      client.repos.get({ owner: ref.owner, repo: ref.repo }),
      client.repos.listReleases({ owner: ref.owner, repo: ref.repo, per_page: 5 }).catch((error) => ({ error })),
    ]);

    let releases: ReleaseRow[] = [];
    let releaseDownloads = 0;
    let releaseError = "";
    if ("data" in releaseResult) {
      releases = mapReleaseRows(ref, releaseResult.data);
      releaseDownloads = sumReleaseDownloads(releaseResult.data);
    } else {
      releaseError = releaseResult.error?.message ?? String(releaseResult.error);
    }

    if (releases.length === 0) {
      try {
        releases = await fetchRecentTags(client, ref.owner, ref.repo);
      } catch (error: any) {
        if (!releaseError) releaseError = error?.message ?? String(error);
      }
    }

    let latestVersion = releases[0]?.tag_name ?? "";
    try {
      const latest = await client.repos.getLatestRelease({ owner: ref.owner, repo: ref.repo });
      latestVersion = boundedSingleLineText(latest.data.tag_name, MAX_RELEASE_TAG_CHARS);
    } catch {
      // Tags or the first release are an acceptable version fallback.
    }

    const pushedAt = normalizeTimestamp(data.pushed_at) ?? normalizeTimestamp(data.updated_at);
    const patch: Partial<ProjectRow> = {
      stars: normalizeCount(data.stargazers_count),
      language: boundedSingleLineText(data.language, MAX_GITHUB_TEXT_CHARS),
      last_update: pushedAt,
      version: latestVersion || undefined,
      github_is_fork: Boolean(data.fork),
      github_parent_url: normalizeGithubRepoUrl(data.parent?.html_url),
      github_source_url: normalizeGithubRepoUrl(data.source?.html_url),
    };

    const extra = typeof project.extra === "object" && project.extra ? { ...project.extra } : {};
    extra.releases = releases;
    extra.github_release_downloads = releaseDownloads;
    if (releaseError) extra.github_release_error = releaseError.slice(0, 200);
    else delete extra.github_release_error;
    patch.extra = extra;

    const currentStatus = String(project.status ?? "").trim();
    if (currentStatus !== "不活跃") {
      const evaluated = evaluateStatusFromPush(pushedAt);
      if (evaluated) patch.status = evaluated;
    }

    if (opts?.dryRun) return { id: project.id, updated: true };

    await updateProjectGithubMetadata(project.id, patch);
    return { id: project.id, updated: true };
  } catch (e: any) {
    const error = e?.message ?? String(e);
    if (!opts?.dryRun) await markProjectGithubSyncAttempt(project.id, error);
    return { id: project.id, updated: false, error };
  }
}

export async function syncAllProjectsFromGithub(opts?: { limit?: number; dryRun?: boolean }) {
  const rows = opts?.limit
    ? await sql()<SyncableProject[]>`
        select id, github_url, status, extra from projects
        where github_url is not null and trim(github_url) <> ''
        order by github_synced_at asc nulls first, updated_at asc nulls first
        limit ${opts.limit}
      `
    : await sql()<SyncableProject[]>`
        select id, github_url, status, extra from projects
        where github_url is not null and trim(github_url) <> ''
        order by github_synced_at asc nulls first, updated_at asc nulls first
      `;

  const client = octokit();
  let updated = 0;
  let failed = 0;
  let skipped = 0;
  const errors: Array<{ id: string; error: string }> = [];

  for (const row of rows) {
    const result = await syncProjectFromGithub(row, { dryRun: opts?.dryRun, octokitClient: client });
    if (result.skipped) skipped++;
    else if (result.error) {
      failed++;
      errors.push({ id: result.id, error: result.error });
    } else if (result.updated) updated++;
    await new Promise((r) => setTimeout(r, 400));
  }

  return { total: rows.length, updated, failed, skipped, errors: errors.slice(0, 20) };
}
