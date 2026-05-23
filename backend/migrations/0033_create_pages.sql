CREATE TABLE IF NOT EXISTS pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  "group" TEXT DEFAULT '',
  icon TEXT DEFAULT '',
  required_capability TEXT DEFAULT '',
  is_visible BOOLEAN DEFAULT true,
  sort_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pages_group ON pages("group");
CREATE INDEX IF NOT EXISTS idx_pages_path ON pages(path);

INSERT INTO pages (path, title, "group", icon, required_capability, is_visible, sort_index) VALUES
  ('/', '首页', '公开', 'Home', '', true, 1),
  ('/today', '今日推荐', '公开', 'Sparkles', '', true, 2),
  ('/categories', '分类浏览', '公开', 'Grid3x3', '', true, 3),
  ('/about', '关于', '公开', 'Info', '', true, 4),
  ('/compare', '对比', '公开', 'GitCompare', '', true, 5),
  ('/submit', '提交项目', '公开', 'Upload', 'user:submit_project', true, 6),
  ('/me', '个人中心', '用户', 'User', '', true, 10),
  ('/dev/dashboard', '开发者总览', '开发者', 'LayoutDashboard', 'dev_panel_access', true, 20),
  ('/dev/organizations', '组织管理', '开发者', 'Building2', 'dev_panel_access', true, 21),
  ('/dev/projects', '项目管理', '开发者', 'Package', 'dev_panel_access', true, 22),
  ('/dev/bugs', 'Bug 反馈', '开发者', 'Bug', 'dev:bug_manage', true, 23),
  ('/dev/comments', '评论管理', '开发者', 'MessageSquare', 'dev:comment_manage', true, 24),
  ('/admin/dashboard', '运维总览', '运维', 'LayoutDashboard', 'admin_panel_access', true, 30),
  ('/admin/stories', '文章管理', '运维', 'FileText', 'story:manage', true, 31),
  ('/admin/projects', '项目管理', '运维', 'Package', 'project:read', true, 32),
  ('/admin/review', '审核', '运维', 'ClipboardCheck', 'submission:read', true, 33),
  ('/admin/users', '用户权限', '运维', 'Users', 'user:read', true, 34),
  ('/admin/developers', '开发者与组织', '运维', 'UserCog', 'dev:developer_manage', true, 35),
  ('/admin/media', '图床管理', '运维', 'Image', 'media:read', true, 36),
  ('/admin/audit', '审计日志', '运维', 'ScrollText', 'audit:read', true, 37),
  ('/admin/analytics', '数据分析', '运维', 'BarChart3', 'analytics:read', true, 38),
  ('/admin/routes', '路由管理', '运维', 'Route', 'route:manage', true, 39)
ON CONFLICT (path) DO NOTHING;

INSERT INTO capabilities (id, name, category, description, sort_index) VALUES
  ('route:manage', '路由管理', 'ops.system', '管理网站路由页面', 2450)
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_capabilities (user_id, capability_id)
  SELECT uc.user_id, 'route:manage'
  FROM user_capabilities uc
  WHERE uc.capability_id = 'admin_panel_access'
ON CONFLICT DO NOTHING;
