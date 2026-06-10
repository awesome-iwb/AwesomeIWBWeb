ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS github_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS github_sync_error text not null default '';

CREATE INDEX IF NOT EXISTS projects_github_sync_due_idx
  ON projects (github_synced_at asc nulls first)
  WHERE github_url is not null and trim(github_url) <> '';

CREATE TABLE IF NOT EXISTS sync_job_locks (
  job_key text primary key,
  locked_until timestamptz not null,
  owner text not null default '',
  updated_at timestamptz not null default now()
);
