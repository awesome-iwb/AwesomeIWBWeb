INSERT INTO capabilities (id, name, category, description, sort_index) VALUES
  ('admin_panel_access', '访问运维后台', 'panel', '查看和进入运维管理后台', 10),
  ('dev_panel_access', '访问开发者后台', 'panel', '查看和进入开发者后台', 20),
  ('comment:manage', '管理评论', 'comment', '管理自己和他人的评论/Issue状态', 1950)
ON CONFLICT (id) DO NOTHING;

-- 为现有 ops 角色用户自动授予所有能力
INSERT INTO user_capabilities (user_id, capability_id)
SELECT u.id, c.id FROM users u, capabilities c
WHERE u.role = 'ops'
ON CONFLICT (user_id, capability_id) DO NOTHING;
