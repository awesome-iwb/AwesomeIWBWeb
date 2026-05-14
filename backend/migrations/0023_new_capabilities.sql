-- Migration: new capabilities for user/dev/org/claim categories
-- Date: 2026-05-15

INSERT INTO capabilities (id, name, category, description, sort_index) VALUES
  ('user:comment', '发表评论', 'user', '发表项目评论', 10),
  ('user:avatar', '上传头像', 'user', '上传和更改头像', 20),
  ('user:feedback', '提交反馈', 'user', '提交 Bug 反馈', 30),
  ('user:submit_project', '提交项目', 'user', '提交新项目申请', 40),
  ('user:profile', '修改资料', 'user', '修改个人资料', 50),
  ('user:create_org', '创建组织', 'user', '申请创建组织', 60),
  ('dev:project_edit', '编辑项目', 'dev', '编辑自己参与的项目', 2100),
  ('dev:bug_manage', '管理 Bug', 'dev', '处理自己项目的 Bug 反馈', 2200),
  ('dev:comment_manage', '管理评论', 'dev', '管理自己项目的评论', 2300),
  ('dev:stats_view', '查看数据', 'dev', '查看自己项目的统计数据', 2400),
  ('dev:member_manage', '管理成员', 'dev', '管理项目/组织成员', 2500),
  ('org:review', '审核组织', 'org', '审核组织创建申请', 2600),
  ('claim:review', '审核认领', 'claim', '审核项目认领申请', 2700),
  ('org:manage', '管理组织', 'org', '管理组织状态', 2800)
ON CONFLICT (id) DO NOTHING;
