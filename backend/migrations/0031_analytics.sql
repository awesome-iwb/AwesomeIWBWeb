CREATE TABLE page_views (
  id BIGSERIAL PRIMARY KEY,
  path TEXT NOT NULL,
  referrer TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_page_views_path ON page_views(path);
CREATE INDEX idx_page_views_created_at ON page_views(created_at);

CREATE TABLE click_events (
  id BIGSERIAL PRIMARY KEY,
  project_slug TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'click',
  referrer TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_click_events_project_slug ON click_events(project_slug);
CREATE INDEX idx_click_events_created_at ON click_events(created_at);
CREATE INDEX idx_click_events_type ON click_events(event_type);

CREATE TABLE search_queries (
  id BIGSERIAL PRIMARY KEY,
  query TEXT NOT NULL,
  results_count INTEGER NOT NULL DEFAULT 0,
  user_agent TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_search_queries_query ON search_queries(query);
CREATE INDEX idx_search_queries_created_at ON search_queries(created_at);

INSERT INTO capabilities (id, name, category, description, sort_index) VALUES
  ('analytics:read', '查看数据分析', 'admin.analytics', '查看网站访问统计和用户行为分析', 300)
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_capabilities (user_id, capability_id)
  SELECT uc.user_id, 'analytics:read'
  FROM user_capabilities uc
  WHERE uc.capability_id = 'admin_panel_access'
ON CONFLICT (user_id, capability_id) DO NOTHING;
