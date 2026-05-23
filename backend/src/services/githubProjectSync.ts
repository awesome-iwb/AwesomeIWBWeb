import { Octokit } from "@octokit/rest";
import { sql } from "../db/client";
import { updateProject, type ProjectRow } from "./projects";

export type GithubRepoRef = { owner: string; repo: string };

export function parseGithubRepoUrl(githubUrl: string): GithubRepoRef | null {
  const raw = String(githubUrl ?? "").trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.hostname !== "github.com") return null;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1].replace(/\.git$/i, "") };
  } catch {
    return null;
  }
}

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

async function fetchRecentReleases(octokitClient: Octokit, owner: string, repo: string): Promise<ReleaseRow[]> {
  try {
    const { data } = await octokitClient.repos.listReleases({ owner, repo, per_page: 5 });
    return (data ?? []).map((r) => ({
      tag_name: r.tag_name ?? "",
      published_at: r.published_at ?? null,
      body: r.body ?? "",
      html_url: r.html_url ?? "",
    })).filter((r) => r.tag_name);
  } catch {
    return [];
  }
}

function sumReleaseDownloads(releases: Awaited<ReturnType<Octokit["repos"]["listReleases"]>>["data"]): number {
  let total = 0;
  for (const rel of releases ?? []) {
    for (const asset of rel.assets ?? []) {
      total += asset.download_count ?? 0;
    }
  }
  return total;
}

export type SyncGithubProjectResult = {
  id: string;
  updated: boolean;
  skipped?: string;
  error?: string;
};

export async function syncProjectFromGithub(
  project: Pick<ProjectRow, "id" | "github_url" | "status" | "extra">,
  opts?: { dryRun?: boolean; octokitClient?: Octokit }
): Promise<SyncGithubProjectResult> {
  const ref = parseGithubRepoUrl(project.github_url);
  if (!ref) return { id: project.id, updated: false, skipped: "invalid_github_url" };

  const client = opts?.octokitClient ?? octokit();
  try {
    const { data } = await client.repos.get({ owner: ref.owner, repo: ref.repo });
    const releases = await fetchRecentReleases(client, ref.owner, ref.repo);
    let latestVersion = "";
    try {
      const latest = await client.repos.getLatestRelease({ owner: ref.owner, repo: ref.repo });
      latestVersion = latest.data.tag_name ?? "";
    } catch {
      if (releases[0]?.tag_name) latestVersion = releases[0].tag_name;
    }

    const pushedAt = data.pushed_at ?? data.updated_at ?? null;
    const patch: Partial<ProjectRow> = {
      stars: data.stargazers_count ?? 0,
      language: data.language ?? "",
      last_update: pushedAt,
      version: latestVersion || undefined,
      github_is_fork: Boolean(data.fork),
      github_parent_url: data.parent?.html_url ?? "",
      github_source_url: data.source?.html_url ?? "",
    };

    const extra = typeof project.extra === "object" && project.extra ? { ...project.extra } : {};
    extra.releases = releases;
    try {
      const relList = await client.repos.listReleases({ owner: ref.owner, repo: ref.repo, per_page: 3 });
      extra.github_release_downloads = sumReleaseDownloads(relList.data);
    } catch {
      /* optional */
    }
    patch.extra = extra;

    const currentStatus = String(project.status ?? "").trim();
    if (currentStatus !== "不活跃") {
      const evaluated = evaluateStatusFromPush(pushedAt);
      if (evaluated) patch.status = evaluated;
    }

    if (opts?.dryRun) return { id: project.id, updated: true };

    await updateProject(project.id, patch);
    return { id: project.id, updated: true };
  } catch (e: any) {
    return { id: project.id, updated: false, error: e?.message ?? String(e) };
  }
}

export async function syncAllProjectsFromGithub(opts?: { limit?: number; dryRun?: boolean }) {
  const rows = opts?.limit
    ? await sql()<Array<Pick<ProjectRow, "id" | "github_url" | "status" | "extra">>>`
        select id, github_url, status, extra from projects
        where github_url is not null and trim(github_url) <> ''
        order by updated_at asc nulls first
        limit ${opts.limit}
      `
    : await sql()<Array<Pick<ProjectRow, "id" | "github_url" | "status" | "extra">>>`
        select id, github_url, status, extra from projects
        where github_url is not null and trim(github_url) <> ''
        order by updated_at asc nulls first
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
