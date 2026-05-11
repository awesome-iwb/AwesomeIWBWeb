-- Migration: add user:delete capability
-- Date: 2026-05-11

INSERT INTO capabilities (id, name, category, description, sort_index) VALUES
  ('user:delete', '删除用户', 'user', '删除用户账号', 1650)
ON CONFLICT (id) DO NOTHING;
