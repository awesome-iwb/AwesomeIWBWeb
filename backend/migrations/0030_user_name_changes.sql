CREATE TABLE user_name_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  old_name TEXT NOT NULL,
  new_name TEXT NOT NULL,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'self',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX name_changes_user_idx ON user_name_changes(user_id);

INSERT INTO capabilities (id, name, category, description, sort_index) VALUES
  ('user:rename', '修改用户名', 'user.personal', '修改自己的用户名', 220)
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_capabilities (user_id, capability_id)
  SELECT uc.user_id, 'user:rename'
  FROM user_capabilities uc
  WHERE uc.capability_id = 'user:profile'
ON CONFLICT (user_id, capability_id) DO NOTHING;
