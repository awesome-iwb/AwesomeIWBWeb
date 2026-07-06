CREATE TABLE IF NOT EXISTS notification_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'success', 'warning', 'danger')),
  audience_kind TEXT NOT NULL DEFAULT 'all' CHECK (audience_kind IN ('all', 'users')),
  target_user_names TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent')),
  sent_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  sent_by TEXT NOT NULL DEFAULT '',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notification_campaigns_status_created_idx
  ON notification_campaigns (status, created_at DESC);

DROP TRIGGER IF EXISTS notification_campaigns_updated_at ON notification_campaigns;
CREATE TRIGGER notification_campaigns_updated_at
  BEFORE UPDATE ON notification_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'moderation_approved',
    'moderation_rejected',
    'role_promoted',
    'role_demoted',
    'org_approved',
    'org_rejected',
    'claim_approved',
    'claim_rejected',
    'article_edited',
    'article_comment',
    'article_annotation',
    'article_conflict',
    'ops_notice'
  ));

INSERT INTO capabilities (id, name, category, description, sort_index) VALUES
  ('notification:manage', '通知管理', 'ops.content', '新建、编辑并发送站内运营通知', 2350)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  sort_index = EXCLUDED.sort_index;

INSERT INTO user_capabilities (user_id, capability_id)
  SELECT uc.user_id, 'notification:manage'
  FROM user_capabilities uc
  WHERE uc.capability_id = 'admin_panel_access'
ON CONFLICT DO NOTHING;

INSERT INTO pages (path, title, "group", icon, required_capability, is_visible, sort_index) VALUES
  ('/admin/notifications', '通知管理', '运维', 'Bell', 'notification:manage', true, 40)
ON CONFLICT (path) DO UPDATE SET
  title = EXCLUDED.title,
  "group" = EXCLUDED."group",
  icon = EXCLUDED.icon,
  required_capability = EXCLUDED.required_capability,
  is_visible = EXCLUDED.is_visible,
  sort_index = EXCLUDED.sort_index,
  updated_at = now();
