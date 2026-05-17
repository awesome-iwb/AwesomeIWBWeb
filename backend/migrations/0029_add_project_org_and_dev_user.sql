-- Migration 0029: Add organization_id and developer_user_id to projects

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS organization_id UUID NULL REFERENCES organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS developer_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL;

UPDATE projects p
SET developer_user_id = u.id
FROM users u
WHERE p.developer = u.name
  AND p.developer != ''
  AND p.developer_user_id IS NULL;

UPDATE projects p
SET organization_id = pm.org_id
FROM (
  SELECT DISTINCT ON (project_id) project_id, org_id
  FROM project_members
  WHERE org_id IS NOT NULL
  ORDER BY project_id, joined_at ASC
) pm
WHERE p.id = pm.project_id
  AND p.organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_projects_organization_id ON projects(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_developer_user_id ON projects(developer_user_id) WHERE developer_user_id IS NOT NULL;
