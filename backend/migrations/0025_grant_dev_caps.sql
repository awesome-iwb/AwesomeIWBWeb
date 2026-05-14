-- Migration: grant dev capabilities to existing dev/ops users
-- Date: 2026-05-15

INSERT INTO user_capabilities (user_id, capability_id)
SELECT u.id, c.id FROM users u, capabilities c
WHERE u.role IN ('dev', 'ops') AND c.id IN (
  'dev_panel_access', 'dev:project_edit', 'dev:bug_manage',
  'dev:comment_manage', 'dev:stats_view', 'dev:member_manage'
)
ON CONFLICT (user_id, capability_id) DO NOTHING;
