import { sql } from "../db/client";
import { syncAllProjectsFromGithub, syncProjectFromGithub, type SyncGithubProjectResult } from "./githubProjectSync";
import type { ProjectRow } from "./projects";

export const GITHUB_SYNC_JOB_KEY = "github_project_stats";

export const ALLOWED_INTERVAL_HOURS = [6, 12, 24, 48, 168] as const;
export type AllowedIntervalHours = (typeof ALLOWED_INTERVAL_HOURS)[number];

export type SyncRunStatus = "success" | "partial" | "failed";

export type SyncRunSummary = {
  total: number;
  updated: number;
  failed: number;
  skipped: number;
  errors?: Array<{ id: string; error: string }>;
  error_snippet?: string;
};

export type GithubSyncSettingsRow = {
  job_key: string;
  enabled: boolean;
  interval_hours: number;
  last_run_at: string | null;
  last_run_status: SyncRunStatus | null;
  last_run_summary: SyncRunSummary | null;
  next_run_at: string | null;
  updated_at: string;
};

export type GithubSyncStatus = {
  enabled: boolean;
  interval_hours: number;
  interval_options: AllowedIntervalHours[];
  last_run_at: string | null;
  last_run_status: SyncRunStatus | null;
  last_run_summary: SyncRunSummary | null;
  next_run_at: string | null;
  github_token_configured: boolean;
  running: boolean;
};

const SCHEDULER_CHECK_MS = 15 * 60 * 1000;

let syncRunning = false;
let syncRunPromise: Promise<SyncRunSummary & { status: SyncRunStatus }> | null = null;
let schedulerStarted = false;
const SYNC_LOCK_TTL_MS = 2 * 60 * 60 * 1000;

export function isGithubTokenConfigured(): boolean {
  return Boolean(process.env.GITHUB_TOKEN?.trim());
}

export function isAllowedIntervalHours(value: number): value is AllowedIntervalHours {
  return (ALLOWED_INTERVAL_HOURS as readonly number[]).includes(value);
}

export function computeNextRunAt(
  lastRunAt: Date | string | null | undefined,
  intervalHours: number,
  now: Date = new Date()
): Date | null {
  if (!lastRunAt) return null;
  const last = new Date(lastRunAt);
  if (Number.isNaN(last.getTime())) return null;
  return new Date(last.getTime() + intervalHours * 3600000);
}

export function isSyncDue(
  settings: Pick<GithubSyncSettingsRow, "enabled" | "last_run_at" | "interval_hours" | "next_run_at">,
  now: Date = new Date()
): boolean {
  if (!settings.enabled) return false;
  if (!settings.last_run_at) return true;
  const next = settings.next_run_at
    ? new Date(settings.next_run_at)
    : computeNextRunAt(settings.last_run_at, settings.interval_hours, now);
  if (!next || Number.isNaN(next.getTime())) return true;
  return now.getTime() >= next.getTime();
}

export function deriveRunStatus(summary: Pick<SyncRunSummary, "updated" | "failed" | "total">): SyncRunStatus {
  if (summary.failed === 0) return "success";
  if (summary.updated > 0) return "partial";
  return "failed";
}

function toSummary(result: Awaited<ReturnType<typeof syncAllProjectsFromGithub>>): SyncRunSummary {
  const summary: SyncRunSummary = {
    total: result.total,
    updated: result.updated,
    failed: result.failed,
    skipped: result.skipped,
  };
  if (result.errors?.length) {
    summary.errors = result.errors;
    summary.error_snippet = result.errors[0]?.error?.slice(0, 200) ?? "";
  }
  return summary;
}

function rowToStatus(row: GithubSyncSettingsRow): GithubSyncStatus {
  return {
    enabled: row.enabled,
    interval_hours: row.interval_hours,
    interval_options: [...ALLOWED_INTERVAL_HOURS],
    last_run_at: row.last_run_at,
    last_run_status: row.last_run_status,
    last_run_summary: row.last_run_summary,
    next_run_at: row.next_run_at,
    github_token_configured: isGithubTokenConfigured(),
    running: syncRunning,
  };
}

export async function getGithubSyncSettingsRow(): Promise<GithubSyncSettingsRow> {
  const rows = await sql()<GithubSyncSettingsRow[]>`
    select job_key, enabled, interval_hours, last_run_at, last_run_status, last_run_summary, next_run_at, updated_at
    from sync_job_settings
    where job_key = ${GITHUB_SYNC_JOB_KEY}
    limit 1
  `;
  if (rows[0]) return rows[0];

  await sql()`
    insert into sync_job_settings (job_key, enabled, interval_hours)
    values (${GITHUB_SYNC_JOB_KEY}, true, 24)
    on conflict (job_key) do nothing
  `;

  const seeded = await sql()<GithubSyncSettingsRow[]>`
    select job_key, enabled, interval_hours, last_run_at, last_run_status, last_run_summary, next_run_at, updated_at
    from sync_job_settings
    where job_key = ${GITHUB_SYNC_JOB_KEY}
    limit 1
  `;
  return seeded[0]!;
}

export async function getGithubSyncStatus(): Promise<GithubSyncStatus> {
  const row = await getGithubSyncSettingsRow();
  return rowToStatus(row);
}

export async function updateGithubSyncSettings(input: {
  interval_hours?: number;
  enabled?: boolean;
}): Promise<GithubSyncStatus> {
  const current = await getGithubSyncSettingsRow();

  const intervalHours =
    input.interval_hours !== undefined ? Number(input.interval_hours) : current.interval_hours;
  if (!isAllowedIntervalHours(intervalHours)) {
    throw new Error("INVALID_INTERVAL_HOURS");
  }

  const enabled = input.enabled !== undefined ? Boolean(input.enabled) : current.enabled;
  const nextRunAt = computeNextRunAt(current.last_run_at, intervalHours);

  await sql()`
    update sync_job_settings
    set enabled = ${enabled},
        interval_hours = ${intervalHours},
        next_run_at = ${nextRunAt ? nextRunAt.toISOString() : null},
        updated_at = now()
    where job_key = ${GITHUB_SYNC_JOB_KEY}
  `;

  return getGithubSyncStatus();
}

async function persistRunResult(summary: SyncRunSummary, status: SyncRunStatus) {
  const settings = await getGithubSyncSettingsRow();
  const lastRunAt = new Date();
  const nextRunAt = computeNextRunAt(lastRunAt, settings.interval_hours);

  await sql()`
    update sync_job_settings
    set last_run_at = ${lastRunAt.toISOString()},
        last_run_status = ${status},
        last_run_summary = ${sql().json(summary as any)},
        next_run_at = ${nextRunAt ? nextRunAt.toISOString() : null},
        updated_at = now()
    where job_key = ${GITHUB_SYNC_JOB_KEY}
  `;
}

async function tryAcquireSyncLock(owner: string) {
  const lockedUntil = new Date(Date.now() + SYNC_LOCK_TTL_MS).toISOString();
  const rows = await sql()<Array<{ acquired: boolean }>>`
    insert into sync_job_locks (job_key, locked_until, owner)
    values (${GITHUB_SYNC_JOB_KEY}, ${lockedUntil}, ${owner})
    on conflict (job_key) do update
      set locked_until = excluded.locked_until,
          owner = excluded.owner,
          updated_at = now()
      where sync_job_locks.locked_until < now()
    returning true as acquired
  `;
  return rows[0]?.acquired === true;
}

async function releaseSyncLock(owner: string) {
  await sql()`
    delete from sync_job_locks
    where job_key = ${GITHUB_SYNC_JOB_KEY} and owner = ${owner}
  `;
}

export function isGithubSyncRunning(): boolean {
  return syncRunning;
}

export async function runGithubProjectSync(opts?: {
  limit?: number;
  dryRun?: boolean;
  trigger?: "manual" | "scheduled" | "script";
}): Promise<SyncRunSummary & { status: SyncRunStatus }> {
  if (syncRunning && syncRunPromise) return syncRunPromise;
  if (syncRunning) {
    return {
      total: 0,
      updated: 0,
      failed: 0,
      skipped: 0,
      status: "failed",
      error_snippet: "GitHub sync is already running in this backend process",
    };
  }

  syncRunning = true;
  const lockOwner = `${opts?.trigger ?? "manual"}:${crypto.randomUUID()}`;
  syncRunPromise = (async () => {
    let lockAcquired = false;
    try {
      lockAcquired = await tryAcquireSyncLock(lockOwner);
      if (!lockAcquired) {
        return {
          total: 0,
          updated: 0,
          failed: 0,
          skipped: 0,
          status: "failed",
          error_snippet: "GitHub sync is already running in another backend process",
        };
      }

      const result = await syncAllProjectsFromGithub({ limit: opts?.limit, dryRun: opts?.dryRun });
      const summary = toSummary(result);
      const status = deriveRunStatus(summary);

      if (!opts?.dryRun) {
        await persistRunResult(summary, status);
      }

      return { ...summary, status };
    } catch (e: any) {
      const summary: SyncRunSummary = {
        total: 0,
        updated: 0,
        failed: 0,
        skipped: 0,
        error_snippet: String(e?.message ?? e).slice(0, 200),
      };
      const status: SyncRunStatus = "failed";
      if (!opts?.dryRun) {
        await persistRunResult(summary, status);
      }
      return { ...summary, status };
    } finally {
      if (lockAcquired) {
        try {
          await releaseSyncLock(lockOwner);
        } catch (e) {
          console.error("[github-sync] failed to release advisory lock:", e);
        }
      }
      syncRunning = false;
      syncRunPromise = null;
    }
  })();

  return syncRunPromise;
}

export async function runSingleProjectGithubSync(
  project: Pick<ProjectRow, "id" | "github_url" | "status" | "extra">,
  opts?: { dryRun?: boolean; trigger?: "manual" | "script" }
): Promise<SyncGithubProjectResult> {
  if (syncRunning) {
    return {
      id: project.id,
      updated: false,
      error: "GitHub sync is already running in this backend process",
    };
  }

  syncRunning = true;
  const lockOwner = `${opts?.trigger ?? "manual"}:single:${project.id}:${crypto.randomUUID()}`;
  let lockAcquired = false;
  try {
    lockAcquired = await tryAcquireSyncLock(lockOwner);
    if (!lockAcquired) {
      return {
        id: project.id,
        updated: false,
        error: "GitHub sync is already running in another backend process",
      };
    }

    return await syncProjectFromGithub(project, { dryRun: opts?.dryRun });
  } finally {
    if (lockAcquired) {
      try {
        await releaseSyncLock(lockOwner);
      } catch (e) {
        console.error("[github-sync] failed to release single-project lock:", e);
      }
    }
    syncRunning = false;
  }
}

async function schedulerTick() {
  if (syncRunning) return;
  try {
    const settings = await getGithubSyncSettingsRow();
    if (!isSyncDue(settings)) return;
    console.log("[github-sync-scheduler] starting scheduled sync");
    const result = await runGithubProjectSync({ trigger: "scheduled" });
    console.log(
      `[github-sync-scheduler] finished: status=${result.status} updated=${result.updated} failed=${result.failed}`
    );
  } catch (e) {
    console.error("[github-sync-scheduler] tick failed:", e);
  }
}

export function startGithubSyncScheduler() {
  if (schedulerStarted) return;
  if (process.env.DISABLE_GITHUB_SYNC_SCHEDULER === "1") return;
  schedulerStarted = true;

  void schedulerTick();
  setInterval(() => {
    void schedulerTick();
  }, SCHEDULER_CHECK_MS);
}
