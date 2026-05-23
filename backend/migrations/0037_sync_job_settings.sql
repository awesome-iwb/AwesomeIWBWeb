CREATE TABLE IF NOT EXISTS sync_job_settings (
  job_key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  interval_hours INTEGER NOT NULL DEFAULT 24 CHECK (interval_hours > 0),
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT CHECK (last_run_status IS NULL OR last_run_status IN ('success', 'partial', 'failed')),
  last_run_summary JSONB,
  next_run_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO sync_job_settings (job_key, enabled, interval_hours)
VALUES ('github_project_stats', true, 24)
ON CONFLICT (job_key) DO NOTHING;
