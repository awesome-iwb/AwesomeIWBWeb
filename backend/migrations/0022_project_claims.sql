-- Migration: project_claims table
-- Date: 2026-05-15

CREATE TABLE IF NOT EXISTS project_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  review_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS claims_status_idx ON project_claims(status);
CREATE INDEX IF NOT EXISTS claims_user_idx ON project_claims(user_id);
CREATE INDEX IF NOT EXISTS claims_project_idx ON project_claims(project_id);
