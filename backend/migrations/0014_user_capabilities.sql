-- Migration: capabilities and user_capabilities tables for fine-grained permissions
-- Date: 2026-05-10

CREATE TABLE IF NOT EXISTS capabilities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_capabilities (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  capability_id TEXT NOT NULL REFERENCES capabilities(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, capability_id)
);

CREATE INDEX IF NOT EXISTS user_capabilities_user_idx ON user_capabilities (user_id);

INSERT INTO capabilities (id, name, category, description, sort_index) VALUES
  ('project:read', '查看项目', 'project', '查看项目列表和详情', 100),
  ('project:create', '创建项目', 'project', '创建新项目', 200),
  ('project:update', '编辑项目', 'project', '编辑项目信息', 300),
  ('project:delete', '删除项目', 'project', '删除项目', 400),
  ('project:rollback', '版本回滚', 'project', '回滚项目到历史版本', 500),
  ('project:import', '批量导入', 'project', '导入 JSON/CSV 数据', 600),
  ('project:export', '批量导出', 'project', '导出项目数据', 700),
  ('category:manage', '分类管理', 'category', '增删改分类', 800),
  ('submission:read', '查看提交', 'submission', '查看项目提交列表', 900),
  ('submission:approve', '审核通过', 'submission', '批准项目提交', 1000),
  ('submission:reject', '审核驳回', 'submission', '驳回项目提交', 1100),
  ('moderation:read', '查看审核队列', 'moderation', '查看内容审核队列', 1200),
  ('moderation:approve', '批准内容', 'moderation', '批准评论或 Bug 反馈', 1300),
  ('moderation:reject', '驳回内容', 'moderation', '驳回评论或 Bug 反馈', 1400),
  ('user:read', '查看用户', 'user', '查看用户列表', 1500),
  ('user:manage', '管理用户', 'user', '修改用户角色、状态、权限', 1600),
  ('audit:read', '查看审计日志', 'audit', '查看系统审计日志', 1700),
  ('story:manage', '故事管理', 'story', '管理首页故事', 1800),
  ('feedback:manage', '反馈管理', 'feedback', '管理反馈状态和标签', 1900)
ON CONFLICT (id) DO NOTHING;
