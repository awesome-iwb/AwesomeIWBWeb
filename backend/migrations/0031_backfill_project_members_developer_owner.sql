-- Backfill project_members owner rows from projects.developer_user_id when missing.
-- Idempotent: safe to re-run.

INSERT INTO project_members (project_id, user_id, org_id, role)
SELECT p.id, p.developer_user_id, NULL, 'owner'
FROM projects p
WHERE p.developer_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM project_members pm
    WHERE pm.project_id = p.id
      AND pm.user_id = p.developer_user_id
      AND pm.org_id IS NULL
  );

UPDATE project_members pm
SET role = 'owner'
FROM projects p
WHERE p.id = pm.project_id
  AND pm.user_id = p.developer_user_id
  AND pm.org_id IS NULL
  AND p.developer_user_id IS NOT NULL
  AND pm.role IS DISTINCT FROM 'owner';
