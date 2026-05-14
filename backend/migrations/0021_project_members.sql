-- Migration: project_members table
-- Date: 2026-05-15

CREATE TABLE IF NOT EXISTS project_members (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id UUID NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'collaborator'
    CHECK (role IN ('owner','collaborator')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'), COALESCE(org_id, '00000000-0000-0000-0000-000000000000'))
);

ALTER TABLE project_members
  ADD CONSTRAINT pm_member_target CHECK (
    (user_id IS NOT NULL AND org_id IS NULL) OR
    (user_id IS NULL AND org_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS pm_user_idx ON project_members(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS pm_org_idx ON project_members(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS pm_project_idx ON project_members(project_id);
