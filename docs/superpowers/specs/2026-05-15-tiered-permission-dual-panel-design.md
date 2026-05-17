# 三层权限与双后台系统设计方案

## 日期
2026-05-15

## 背景
当前 AwesomeIWBWeb 项目已有完善的运维后台（/admin），但权限体系存在以下问题：
- 开发者角色（dev）权限过弱，开发者后台（/dev）仅为占位页面
- 权限能力是全局的（有 `project:update` 就能改所有项目），无法限定在"自己的项目"
- 用户权限（评论、头像等）未纳入 capability 体系，无法精细控制
- 缺少组织/团队概念，无法支持团队协作场景

## 目标
1. 建立三层权限体系：用户权限 / 开发者权限 / 运维权限
2. 实现两个独立后台：开发者后台（/dev）+ 运维后台（/admin）
3. 引入组织体系，支持团队协作
4. 权限从"全局能力"扩展为"资源级能力"，开发者只能管理自己参与的项目
5. 用户权限显式化，纳入 capability 体系

## 架构设计

### 三层权限模型

#### 第一层：用户权限（默认拥有）
- **入口**：前端主站（/me、项目详情页）
- **获得方式**：注册即拥有全部用户能力
- **能力列表**：
  - `user:comment` — 发表评论
  - `user:avatar` — 上传/更改头像
  - `user:feedback` — 提交反馈
  - `user:submit_project` — 提交项目
  - `user:profile` — 修改个人资料
  - `user:create_org` — 申请创建组织

#### 第二层：开发者权限（获得项目后自动拥有）
- **入口**：开发者后台（/dev）
- **获得方式**（五种路径）：
  1. 提交项目 → 自动成为项目 owner → 自动提权
  2. 被邀请为项目 collaborator → 自动提权
  3. 加入组织 → 组织下项目自动获得权限 → 自动提权
  4. 申请认领运维收录项目 → 运维审核通过 → 自动提权
  5. 运维在后台手动指定 → 自动提权
- **核心约束**：只能管理自己参与的项目
- **能力列表**：
  - `dev_panel_access` — 访问开发者后台（现有）
  - `dev:project_edit` — 编辑自己参与的项目
  - `dev:bug_manage` — 处理自己项目的 Bug 反馈
  - `dev:comment_manage` — 管理自己项目的评论
  - `dev:stats_view` — 查看自己项目的统计数据
  - `dev:member_manage` — 管理项目/组织成员

#### 第三层：运维权限（手动分配）
- **入口**：运维后台（/admin）
- **获得方式**：超级管理员手动分配
- **新增能力**：
  - `org:review` — 审核组织申请
  - `claim:review` — 审核项目认领
  - `org:manage` — 管理组织状态（暂停/恢复）

### 角色叠加
一个用户可以同时拥有多个角色。角色是能力模板的快捷方式，底层是细粒度 capability 体系。例如一个用户可以既是开发者又是运维。

### 组织体系

#### 组织内部层级
- **Owner** — 创建者，拥有全部管理权限（不可移除自己）
- **Admin** — 可邀请/移除成员，管理组织下项目
- **Member** — 可管理组织下的项目，不能管理成员

#### 组织创建流程
1. 用户申请创建组织 → 运维审核 → 通过后组织生效
2. 创建者自动成为组织 owner

#### 项目归属模型
- **个人项目**：直接关联用户（project_members.user_id）
- **组织项目**：关联组织（project_members.org_id）
- **混合项目**：可同时关联用户和组织（如组织项目 + 外部协作者）
- 组织成员通过 org_id 间接获得项目权限

#### 组织与项目严格分离
- 组织和项目在开发者后台是两个独立的顶级导航项
- 组织页面只管组织相关的事（信息、成员）
- 项目页面只管项目相关的事（信息、成员、Bug、评论）
- 项目如果属于组织，在项目页面里标注"属于 XX 组织"

## 数据模型

### 新增表

#### organizations
```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  avatar_url TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  website_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','suspended')),
  review_note TEXT NOT NULL DEFAULT '',
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX org_status_idx ON organizations(status);
CREATE INDEX org_created_by_idx ON organizations(created_by);
```

#### organization_members
```sql
CREATE TABLE organization_members (
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner','admin','member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (org_id, user_id)
);

CREATE INDEX org_members_user_idx ON organization_members(user_id);
```

#### project_members
```sql
CREATE TABLE project_members (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id UUID NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'collaborator'
    CHECK (role IN ('owner','collaborator')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'), COALESCE(org_id, '00000000-0000-0000-0000-000000000000'))
);

ALTER TABLE project_members
  ADD CONSTRAINT pm_member_target CHECK (
    (user_id IS NOT NULL AND org_id IS NULL) OR
    (user_id IS NULL AND org_id IS NOT NULL)
  );

CREATE INDEX pm_user_idx ON project_members(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX pm_org_idx ON project_members(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX pm_project_idx ON project_members(project_id);
```

#### project_claims
```sql
CREATE TABLE project_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  review_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ NULL
);

CREATE INDEX claims_status_idx ON project_claims(status);
CREATE INDEX claims_user_idx ON project_claims(user_id);
CREATE INDEX claims_project_idx ON project_claims(project_id);
```

### projects 表扩展
保留现有 `developer` 文本字段向后兼容，新增 `project_members` 表做正式的用户-项目关联。前端展示时优先使用 `project_members`，回退到 `developer` 字段。

### 新增能力定义
```sql
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
  ('org:manage', '管理组织', 'org', '管理组织状态', 2800);
```

### 角色模板更新
```typescript
ROLE_TEMPLATES = {
  superadmin: { name: "超级管理员", capabilityIds: getAllCapabilityIds() },
  user: {
    name: "用户",
    capabilityIds: [
      "user:comment", "user:avatar", "user:feedback",
      "user:submit_project", "user:profile", "user:create_org",
    ],
  },
  developer: {
    name: "开发者",
    capabilityIds: [
      "user:comment", "user:avatar", "user:feedback",
      "user:submit_project", "user:profile", "user:create_org",
      "dev_panel_access",
      "dev:project_edit", "dev:bug_manage", "dev:comment_manage",
      "dev:stats_view", "dev:member_manage",
    ],
  },
  reviewer: {
    name: "审核员",
    capabilityIds: [
      "admin_panel_access",
      "submission:read", "submission:approve", "submission:reject",
      "moderation:read", "moderation:approve", "moderation:reject",
      "feedback:manage", "comment:manage",
      "org:review", "claim:review",
    ],
  },
  editor: {
    name: "编辑",
    capabilityIds: [
      "admin_panel_access",
      "story:manage", "project:read", "project:create", "project:update",
      "category:manage", "media:read", "media:manage",
    ],
  },
};
```

## API 设计

### 开发者后台 API (/api/dev)

所有端点需要 `dev_panel_access` 能力 + 资源级校验。

#### 项目管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/dev/projects | 我参与的项目列表 |
| GET | /api/dev/projects/:id | 项目详情（仅自己参与的） |
| PATCH | /api/dev/projects/:id | 编辑自己的项目 |

#### 项目成员管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/dev/projects/:id/members | 查看项目成员 |
| POST | /api/dev/projects/:id/members | 邀请协作者 |
| DELETE | /api/dev/projects/:id/members/:userId | 移除协作者 |

#### Bug 反馈管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/dev/feedback | 我项目的 Bug 列表 |
| PATCH | /api/dev/feedback/:id | 修改 Bug 状态/标签 |
| POST | /api/dev/feedback/:id/replies | 回复 Bug 反馈 |

#### 评论管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/dev/comments | 我项目的评论列表 |
| DELETE | /api/dev/comments/:id | 删除评论 |
| POST | /api/dev/comments/:id/replies | 回复评论 |

#### 项目数据
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/dev/stats | 我项目的统计数据 |
| GET | /api/dev/stats/:projectId | 单项目详细数据 |

#### 组织管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/dev/organizations | 我的组织列表 |
| POST | /api/dev/organizations | 申请创建组织 |
| GET | /api/dev/organizations/:id | 组织详情 |
| PATCH | /api/dev/organizations/:id | 编辑组织信息（owner/admin） |
| GET | /api/dev/organizations/:id/members | 组织成员列表 |
| POST | /api/dev/organizations/:id/members | 邀请成员（owner/admin） |
| DELETE | /api/dev/organizations/:id/members/:userId | 移除成员 |
| PATCH | /api/dev/organizations/:id/members/:userId | 修改成员角色 |

#### 项目认领
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/dev/project-claims | 申请认领项目 |
| GET | /api/dev/project-claims | 我的认领申请 |

### 运维后台扩展 API (/api/admin)

#### 组织审核
| 方法 | 路径 | 能力 | 说明 |
|------|------|------|------|
| GET | /api/admin/organizations | org:review | 组织列表（含 pending） |
| GET | /api/admin/organizations/:id | org:review | 组织详情 |
| POST | /api/admin/organizations/:id/approve | org:review | 批准组织 |
| POST | /api/admin/organizations/:id/reject | org:review | 拒绝组织 |
| PATCH | /api/admin/organizations/:id | org:manage | 编辑组织（暂停等） |
| DELETE | /api/admin/organizations/:id | org:manage | 删除组织 |

#### 项目认领审核
| 方法 | 路径 | 能力 | 说明 |
|------|------|------|------|
| GET | /api/admin/project-claims | claim:review | 认领申请列表 |
| POST | /api/admin/project-claims/:id/approve | claim:review | 批准认领 |
| POST | /api/admin/project-claims/:id/reject | claim:review | 拒绝认领 |

#### 项目成员管理（运维指定开发者）
| 方法 | 路径 | 能力 | 说明 |
|------|------|------|------|
| POST | /api/admin/projects/:id/members | project:update | 指定项目开发者 |
| DELETE | /api/admin/projects/:id/members/:memberId | project:update | 移除项目开发者 |

### 现有 API 修改
| 端点 | 修改内容 |
|------|----------|
| POST /api/submissions | 提交项目后自动创建 project_members(owner)，自动授予 dev_panel_access |
| POST /api/dev/submissions | 校验是否为项目成员 |
| POST /api/feedback | 提交前校验 user:feedback 能力 |
| POST /api/upload | 头像场景校验 user:avatar 能力 |
| GET /api/auth/me | 返回增加 organizations 字段 |
| GET /api/projects/:name | 返回增加 developers 字段（项目开发者列表） |
| GET /api/admin/projects/:id | 返回增加 members 字段 |
| PATCH /api/admin/users/:id/role | 获得项目成员身份时自动提权 |

## 前端设计

### 开发者后台路由
```
/dev                          → redirect /dev/dashboard
/dev/dashboard                → DevDashboardView
/dev/organizations            → DevOrganizationsView
/dev/organizations/:id        → DevOrgDetailView
/dev/organizations/create     → DevOrgCreateView
/dev/projects                 → DevProjectsView
/dev/projects/:id             → DevProjectDetailView
/dev/bugs                     → DevBugsView
/dev/comments                 → DevCommentsView
```
所有路由需要 `dev_panel_access` 能力。

### 运维后台新增路由
```
/admin/organizations          → AdminOrganizationsView (cap: org:review)
/admin/claims                 → AdminClaimsView (cap: claim:review)
```

### 组件设计
- **DevLayout.vue** — 复用 AdminLayout 结构，侧边栏标题改为 "Dev 后台"
- **DevSidebar.vue** — 复用 AdminSidebar 样式，导航项按开发者权限过滤
- **DevBottomNav.vue** — 移动端底部导航
- **MemberManager.vue** — 成员管理通用组件（列表/邀请/移除/改角色）
- **OrgCard.vue** — 组织卡片组件
- **ProjectCard.vue** — 项目卡片组件
- **ClaimStatusBadge.vue** — 认领状态标签
- **AdminOrganizationsView.vue** — 组织审核列表
- **AdminClaimsView.vue** — 项目认领审核列表

### AdminSidebar 新增导航项
- 组织审核（cap: org:review）
- 认领审核（cap: claim:review）

### 前端主站改造
- ProjectDetailView：增加开发者列表展示（用户头像+名称，组织头像+名称）
- MeView：增加"我的组织""我的项目"入口

### 其他前端改动
- 开发者后台路由（/dev）移除 `isDev` 限制，生产环境也可用
- `notifications` 表 type CHECK 约束需扩展，新增 `role_promoted` 和 `role_demoted` 类型
- `useAuth` 扩展：增加 `organizations` 字段、`isProjectMember(projectId)` 方法、`isOrgMember(orgId)` 方法

## 权限流程

### 自动提权逻辑
当用户首次成为项目成员（owner 或 collaborator）或组织成员时：
1. 将 users.role 从 'user' 更新为 'dev'
2. 授予 dev_panel_access + dev:* 系列能力
3. 创建通知告知用户

### 自动降权逻辑
当用户不再是任何项目的成员且不属于任何组织时：
1. 检查用户是否仍持有 `dev_panel_access` 能力（运维可能手动授予了该能力）
2. 如果没有手动保留的 dev 能力，将 users.role 从 'dev' 更新为 'user'
3. 撤销 dev_panel_access + dev:* 系列能力（保留 user:* 能力）
4. 创建通知告知用户

**区分自动授予与手动授予**：自动提权时授予的 dev:* 能力记录在 `user_capabilities` 表中，与手动授予的记录无法区分。降权判断依据为：用户是否仍拥有任何项目成员身份或组织成员身份。如果没有任何成员身份但仍持有 dev 能力，说明是运维手动授予的，不降权。

### 权限校验中间件
新增 `requireProjectMember(projectIdParam)` 辅助函数：
1. 先检查是否有 dev:* 全局能力
2. 再查 project_members 表验证是否为该项目的成员
3. 如果项目关联了组织，检查用户是否为组织成员

### 用户能力校验
现有需要登录的接口增加用户能力校验：
- 评论接口 → user:comment
- 头像上传 → user:avatar
- 反馈提交 → user:feedback
- 项目提交 → user:submit_project
- 资料修改 → user:profile

## 数据库迁移方案

| 迁移 | 内容 |
|------|------|
| 0020 | organizations + organization_members 表 |
| 0021 | project_members 表 |
| 0022 | project_claims 表 |
| 0023 | 新增 14 条能力记录 |
| 0024 | 为所有现有用户授予 user:* 能力 |
| 0025 | 为现有 dev/ops 用户授予 dev:* 能力 |
| 0026 | 为现有 ops 用户授予 org:review, claim:review, org:manage 能力 |
| 0027 | 扩展 notifications.type CHECK 约束，新增 role_promoted / role_demoted / org_approved / org_rejected / claim_approved / claim_rejected 类型 |

## 实施阶段

### Phase 1：数据基础（1-2天）
- 数据库迁移 0020-0026
- 后端 organizations / project_members / project_claims 服务层
- capabilities.ts 扩展新能力定义和角色模板
- 自动提权/降权逻辑

### Phase 2：开发者后台 API（2-3天）
- /api/dev/projects 系列（CRUD + 成员管理）
- /api/dev/feedback 系列（Bug 管理）
- /api/dev/comments 系列（评论管理）
- /api/dev/organizations 系列（组织管理）
- /api/dev/project-claims 系列（项目认领）
- requireProjectMember() 中间件
- 现有 API 改造（提权逻辑、能力校验）

### Phase 3：运维后台扩展（1-2天）
- /api/admin/organizations 系列（组织审核）
- /api/admin/project-claims 系列（认领审核）
- /api/admin/projects/:id/members（指定开发者）
- AdminSidebar 新增导航项
- AdminOrganizationsView + AdminClaimsView 页面
- ProjectsView 改造（指定开发者功能）

### Phase 4：开发者后台前端（3-4天）
- DevLayout + DevSidebar + DevBottomNav
- DevDashboardView（总览）
- DevOrganizationsView + DevOrgDetailView + DevOrgCreateView
- DevProjectsView + DevProjectDetailView
- DevBugsView
- DevCommentsView
- 共享组件：MemberManager、OrgCard、ProjectCard

### Phase 5：前端主站改造 + 收尾（1-2天）
- ProjectDetailView 增加开发者列表展示
- MeView 增加"我的组织""我的项目"入口
- useAuth 扩展（组织信息、项目成员判断）
- 用户权限校验接入（评论、头像等）
- 全链路测试 + Bug 修复

## 向后兼容

- `projects.developer` 文本字段保留，前端展示时优先使用 project_members，回退到 developer 字段
- 现有运维后台功能不受影响，仅新增导航项和页面
- JSON 模式（无 DATABASE_URL）下，权限中间件降级为"允许所有"
- 现有 user_capabilities 数据不受影响，新增能力通过迁移脚本自动授予
