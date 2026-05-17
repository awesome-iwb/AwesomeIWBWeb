-- Migration: restructure capability categories into 3-tier hierarchy + split dev:member_manage
-- Date: 2026-05-15

-- 1. Add new capabilities
INSERT INTO capabilities (id, name, category, description, sort_index) VALUES
  ('dev:project_admin', '管理项目成员', 'dev.project_admin', '添加/移除项目协作者、转让所有权', 1120),
  ('dev:org_manage', '管理组织', 'dev.org', '管理组织设置和成员', 1130)
ON CONFLICT (id) DO NOTHING;

-- 2. Migrate user grants from dev:member_manage to the two new capabilities
INSERT INTO user_capabilities (user_id, capability_id)
  SELECT user_id, 'dev:project_admin' FROM user_capabilities WHERE capability_id = 'dev:member_manage'
ON CONFLICT (user_id, capability_id) DO NOTHING;

INSERT INTO user_capabilities (user_id, capability_id)
  SELECT user_id, 'dev:org_manage' FROM user_capabilities WHERE capability_id = 'dev:member_manage'
ON CONFLICT (user_id, capability_id) DO NOTHING;

-- 3. Remove old capability
DELETE FROM user_capabilities WHERE capability_id = 'dev:member_manage';
DELETE FROM capabilities WHERE id = 'dev:member_manage';

-- 4. Update categories to two-level hierarchy
UPDATE capabilities SET category = 'user.social' WHERE id IN ('user:comment', 'user:feedback');
UPDATE capabilities SET category = 'user.personal' WHERE id IN ('user:profile', 'user:avatar');
UPDATE capabilities SET category = 'user.contribute' WHERE id IN ('user:submit_project', 'user:create_org');
UPDATE capabilities SET category = 'dev.access' WHERE id = 'dev_panel_access';
UPDATE capabilities SET category = 'dev.project' WHERE id = 'dev:project_edit';
UPDATE capabilities SET category = 'dev.project_admin' WHERE id = 'dev:project_admin';
UPDATE capabilities SET category = 'dev.org' WHERE id = 'dev:org_manage';
UPDATE capabilities SET category = 'dev.interact' WHERE id IN ('dev:comment_manage', 'dev:bug_manage');
UPDATE capabilities SET category = 'dev.data' WHERE id = 'dev:stats_view';
UPDATE capabilities SET category = 'ops.access' WHERE id = 'admin_panel_access';
UPDATE capabilities SET category = 'ops.project' WHERE id IN ('project:read','project:create','project:update','project:delete','project:rollback','project:import','project:export','category:manage');
UPDATE capabilities SET category = 'ops.review' WHERE id IN ('submission:read','submission:approve','submission:reject','moderation:read','moderation:approve','moderation:reject','org:review','claim:review');
UPDATE capabilities SET category = 'ops.content' WHERE id IN ('story:manage','feedback:manage','comment:manage','media:read','media:manage');
UPDATE capabilities SET category = 'ops.system' WHERE id IN ('user:read','user:manage','user:delete','audit:read','org:manage');

-- 5. Update sort_index for ordered display
UPDATE capabilities SET sort_index = 100 WHERE id = 'user:comment';
UPDATE capabilities SET sort_index = 110 WHERE id = 'user:feedback';
UPDATE capabilities SET sort_index = 200 WHERE id = 'user:profile';
UPDATE capabilities SET sort_index = 210 WHERE id = 'user:avatar';
UPDATE capabilities SET sort_index = 300 WHERE id = 'user:submit_project';
UPDATE capabilities SET sort_index = 310 WHERE id = 'user:create_org';
UPDATE capabilities SET sort_index = 1000 WHERE id = 'dev_panel_access';
UPDATE capabilities SET sort_index = 1100 WHERE id = 'dev:project_edit';
UPDATE capabilities SET sort_index = 1120 WHERE id = 'dev:project_admin';
UPDATE capabilities SET sort_index = 1130 WHERE id = 'dev:org_manage';
UPDATE capabilities SET sort_index = 1200 WHERE id = 'dev:comment_manage';
UPDATE capabilities SET sort_index = 1210 WHERE id = 'dev:bug_manage';
UPDATE capabilities SET sort_index = 1300 WHERE id = 'dev:stats_view';
UPDATE capabilities SET sort_index = 2000 WHERE id = 'admin_panel_access';
UPDATE capabilities SET sort_index = 2100 WHERE id = 'project:read';
UPDATE capabilities SET sort_index = 2110 WHERE id = 'project:create';
UPDATE capabilities SET sort_index = 2120 WHERE id = 'project:update';
UPDATE capabilities SET sort_index = 2130 WHERE id = 'project:delete';
UPDATE capabilities SET sort_index = 2140 WHERE id = 'project:rollback';
UPDATE capabilities SET sort_index = 2150 WHERE id = 'project:import';
UPDATE capabilities SET sort_index = 2160 WHERE id = 'project:export';
UPDATE capabilities SET sort_index = 2170 WHERE id = 'category:manage';
UPDATE capabilities SET sort_index = 2200 WHERE id = 'submission:read';
UPDATE capabilities SET sort_index = 2210 WHERE id = 'submission:approve';
UPDATE capabilities SET sort_index = 2220 WHERE id = 'submission:reject';
UPDATE capabilities SET sort_index = 2230 WHERE id = 'moderation:read';
UPDATE capabilities SET sort_index = 2240 WHERE id = 'moderation:approve';
UPDATE capabilities SET sort_index = 2250 WHERE id = 'moderation:reject';
UPDATE capabilities SET sort_index = 2260 WHERE id = 'org:review';
UPDATE capabilities SET sort_index = 2270 WHERE id = 'claim:review';
UPDATE capabilities SET sort_index = 2300 WHERE id = 'story:manage';
UPDATE capabilities SET sort_index = 2310 WHERE id = 'feedback:manage';
UPDATE capabilities SET sort_index = 2320 WHERE id = 'comment:manage';
UPDATE capabilities SET sort_index = 2330 WHERE id = 'media:read';
UPDATE capabilities SET sort_index = 2340 WHERE id = 'media:manage';
UPDATE capabilities SET sort_index = 2400 WHERE id = 'user:read';
UPDATE capabilities SET sort_index = 2410 WHERE id = 'user:manage';
UPDATE capabilities SET sort_index = 2420 WHERE id = 'user:delete';
UPDATE capabilities SET sort_index = 2430 WHERE id = 'audit:read';
UPDATE capabilities SET sort_index = 2440 WHERE id = 'org:manage';
