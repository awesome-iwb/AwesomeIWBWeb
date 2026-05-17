# 三层用户权限系统重构计划

## 一、现状分析

### 当前问题

1. **分类混乱**：11 个 category（panel/user/project/category/submission/moderation/audit/story/feedback/comment/media/dev/org/claim），没有层级关系，平铺展示
2. **能力 ID 命名不一致**：`user:comment`（用户能力）和 `comment:manage`（运维能力）都在"评论"领域但分属不同 category
3. **角色模板不完整**：只有 5 个模板（superadmin/user/developer/reviewer/editor），缺少运维全权限模板
4. **前端编辑器缺少分组标签**：`dev`/`org`/`claim` 三个分组没有中文标签
5. **新用户注册无默认权限**：迁移 0024 是一次性脚本，后续新注册用户不会自动获得 user:* 权限
6. **开发者权限粒度不够**：`dev:member_manage` 同时覆盖项目成员管理和组织成员管理，没有区分项目 owner/collaborator、组织 owner/admin/member 的权限差异

### 现有能力清单（39 项）

| 当前 category | 能力 ID | 说明 |
|---|---|---|
| user | user:comment, user:avatar, user:feedback, user:submit_project, user:profile, user:create_org | 用户基础能力 |
| user | user:read, user:manage, user:delete | 运维管理用户的能力（和用户基础能力混在同一 category） |
| panel | admin_panel_access, dev_panel_access | 面板访问 |
| project | project:read/create/update/delete/rollback/import/export | 运维管理项目 |
| dev | dev:project_edit/bug_manage/comment_manage/stats_view/member_manage | 开发者管理自己的项目 |
| category | category:manage | 分类管理 |
| submission | submission:read/approve/reject | 提交审核 |
| moderation | moderation:read/approve/reject | 内容审核 |
| org | org:review, org:manage | 组织管理 |
| claim | claim:review | 认领审核 |
| audit | audit:read | 审计日志 |
| story | story:manage | 故事管理 |
| feedback | feedback:manage | 反馈管理 |
| comment | comment:manage | 评论管理 |
| media | media:read/manage | 媒体管理 |

### 现有数据模型中的角色层级

**项目成员**（project_members 表）：
- `owner`：项目所有者，可以添加/移除 collaborator
- `collaborator`：项目协作者，可以编辑项目但不能管成员

**组织成员**（organization_members 表）：
- `owner`：组织创建者，拥有全部管理权限
- `admin`：组织管理员，可以管理成员和项目
- `member`：普通成员，仅参与组织项目

**项目可关联组织**：project_members 同时支持 user_id 和 org_id，一个项目可以同时有个人开发者和组织作为成员。

## 二、目标架构

### 三层权限模型

```
┌──────────────────────────────────────────────────────────────┐
│                      运维权限 (ops)                           │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐       │
│  │  项目管理      │ │  内容审核      │ │  系统管理      │       │
│  │  project:read  │ │  moderation:* │ │  user:read     │       │
│  │  project:create│ │  submission:* │ │  user:manage   │       │
│  │  project:update│ │  feedback:*   │ │  user:delete   │       │
│  │  project:delete│ │  comment:*    │ │  audit:read    │       │
│  │  project:rollbk│ │  org:review   │ │  story:manage  │       │
│  │  project:import│ │  org:manage   │ │  media:*       │       │
│  │  project:export│ │  claim:review │ │  category:*    │       │
│  └───────────────┘ └───────────────┘ └───────────────┘       │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                     开发者权限 (dev)                           │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐       │
│  │  项目开发      │ │  组织管理      │ │  互动与数据    │       │
│  │  dev:project   │ │  dev:org      │ │  dev:comment   │       │
│  │  dev:proj_admin│ │  dev:org_admin│ │  dev:bug       │       │
│  └───────────────┘ │               │ │  dev:stats     │       │
│                    └───────────────┘ └───────────────┘       │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                      用户权限 (user)                          │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐       │
│  │  社交互动      │ │  个人管理      │ │  内容贡献      │       │
│  │  user:comment  │ │  user:profile │ │  user:submit   │       │
│  │  user:feedback │ │  user:avatar  │ │  user:create   │       │
│  └───────────────┘ └───────────────┘ └───────────────┘       │
└──────────────────────────────────────────────────────────────┘
```

### 新增能力项（从 39 项扩展到 42 项）

拆分 `dev:member_manage` 为三个更细粒度的能力，新增 `dev:org_manage`：

| 新能力 ID | 名称 | 说明 | 替代 |
|---|---|---|---|
| `dev:project_edit` | 编辑项目 | 编辑自己参与的项目信息（owner 和 collaborator 均可） | 保留不变 |
| `dev:project_admin` | 管理项目成员 | 添加/移除项目协作者、转让项目所有权（仅 owner） | 从 `dev:member_manage` 拆出 |
| `dev:org_manage` | 管理组织 | 管理组织设置和成员（组织 owner/admin） | 新增 |
| `dev:bug_manage` | 管理 Bug | 处理自己项目的 Bug 反馈 | 保留不变 |
| `dev:comment_manage` | 管理评论 | 管理自己项目的评论 | 保留不变 |
| `dev:stats_view` | 查看数据 | 查看自己项目的统计数据 | 保留不变 |

**删除**：`dev:member_manage`（拆分为 `dev:project_admin` + `dev:org_manage`）

### 新的 category 体系（两级分类：大类.小类）

| 大类 | 小类 (category) | 包含的能力 | 说明 |
|---|---|---|---|
| **用户权限** | user.social | user:comment, user:feedback | 社交互动 |
| | user.personal | user:profile, user:avatar | 个人管理 |
| | user.contribute | user:submit_project, user:create_org | 内容贡献 |
| **开发者权限** | dev.access | dev_panel_access | 后台访问 |
| | dev.project | dev:project_edit | 项目编辑（collaborator 级） |
| | dev.project_admin | dev:project_admin | 项目管理（owner 级：管成员、转让） |
| | dev.org | dev:org_manage | 组织管理（owner/admin：管成员、管设置） |
| | dev.interact | dev:comment_manage, dev:bug_manage | 互动管理 |
| | dev.data | dev:stats_view | 数据查看 |
| **运维权限** | ops.access | admin_panel_access | 后台访问 |
| | ops.project | project:read/create/update/delete/rollback/import/export, category:manage | 项目管理 |
| | ops.review | submission:read/approve/reject, moderation:read/approve/reject, org:review, claim:review | 审核管理 |
| | ops.content | story:manage, feedback:manage, comment:manage, media:read/manage | 内容管理 |
| | ops.system | user:read/manage/delete, audit:read, org:manage | 系统管理 |

### 角色模板重新设计

| 角色 | 名称 | 包含能力 | 说明 |
|---|---|---|---|
| superadmin | 超级管理员 | 全部 42 项 | 环境变量指定，不可编辑 |
| user | 普通用户 | user.social + user.personal + user.contribute (6项) | 所有新注册用户默认获得 |
| developer | 开发者 | user 全部 + dev.access + dev.project + dev.interact + dev.data (11项) | 基础开发者：可编辑项目、管理 Bug/评论、查看数据 |
| project_admin | 项目管理者 | developer 全部 + dev.project_admin (12项) | 项目 owner：可管理项目成员 |
| org_admin | 组织管理者 | developer 全部 + dev.org_manage + dev.project_admin (13项) | 组织 owner/admin：可管理组织和项目成员 |
| reviewer | 审核员 | ops.access + ops.review (10项) | 运维后台子角色 |
| editor | 内容编辑 | ops.access + ops.content + project:read (8项) | 运维后台子角色 |
| ops | 运维管理员 | user 全部 + dev 全部 + ops 全部 (42项) | 完整运维权限 |

### 开发者权限与数据模型角色的对应关系

```
能力 (capability)          数据模型角色检查
─────────────────────────────────────────────────────────
dev:project_edit     →  requireProjectMember()  (owner 或 collaborator)
dev:project_admin    →  requireProjectOwner()   (仅 owner)
dev:org_manage       →  requireOrgAdmin()       (owner 或 admin)
dev:bug_manage       →  requireProjectMember()
dev:comment_manage   →  requireProjectMember()
dev:stats_view       →  requireProjectMember()
```

关键设计：**capability 是"能否做这类事"的开关，数据模型角色是"能对哪个具体资源做"的校验**。两者配合使用：
- 没有 `dev:project_admin` 能力 → 即使是项目 owner 也不能管理成员
- 有 `dev:project_admin` 能力 → 还需要是具体项目的 owner 才能操作

## 三、具体改动

### 3.1 数据库迁移（0028_restructure_capability_categories.sql）

```sql
-- 1. 新增能力项
INSERT INTO capabilities (id, name, category, description, sort_index) VALUES
  ('dev:project_admin', '管理项目成员', 'dev.project_admin', '添加/移除项目协作者、转让所有权', 1120),
  ('dev:org_manage', '管理组织', 'dev.org', '管理组织设置和成员', 1130)
ON CONFLICT (id) DO NOTHING;

-- 2. 删除旧能力（先迁移授权数据）
INSERT INTO user_capabilities (user_id, capability_id)
  SELECT user_id, 'dev:project_admin' FROM user_capabilities WHERE capability_id = 'dev:member_manage'
ON CONFLICT (user_id, capability_id) DO NOTHING;

INSERT INTO user_capabilities (user_id, capability_id)
  SELECT user_id, 'dev:org_manage' FROM user_capabilities WHERE capability_id = 'dev:member_manage'
ON CONFLICT (user_id, capability_id) DO NOTHING;

DELETE FROM user_capabilities WHERE capability_id = 'dev:member_manage';
DELETE FROM capabilities WHERE id = 'dev:member_manage';

-- 3. 更新所有 category 为两级分类
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

-- 4. 更新 sort_index
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
```

### 3.2 后端 capabilities.ts 改动

1. **更新 ALL_CAPABILITIES**：
   - 删除 `dev:member_manage`
   - 新增 `dev:project_admin`（category: dev.project_admin）和 `dev:org_manage`（category: dev.org）
   - 所有能力的 category 改为新的两级分类，sort_index 重新编排

2. **更新 ROLE_TEMPLATES**：
   - 新增 `project_admin`、`org_admin`、`ops` 模板
   - `developer` 模板不再包含 `dev:member_manage`，改为只含 `dev:project_edit`
   - `reviewer` 和 `editor` 模板适配新分类

3. **新增 `grantDefaultUserCapabilities(userId)` 函数**：为新注册用户自动授予 user 模板的能力

### 3.3 后端 API 路由改动

将原来使用 `requireCapability('dev:member_manage')` 的端点拆分：
- 管理项目成员的端点 → `requireCapability('dev:project_admin')` + `requireProjectOwner()`
- 管理组织成员的端点 → `requireCapability('dev:org_manage')` + 组织 owner/admin 校验

### 3.4 后端注册流程改动

在用户注册/首次登录（OAuth callback）时，自动调用 `grantDefaultUserCapabilities(userId)` 授予用户基础权限。

### 3.5 前端 CapabilityEditor.vue 改动

1. **更新 groupLabels**：添加新的两级分类中文标签
2. **实现三级折叠展示**：大类（用户/开发者/运维）→ 小类 → 具体能力
3. **视觉区分**：三大类用不同颜色标识（用户=蓝色、开发者=紫色、运维=红色）
4. **角色模板下拉框**：新增 project_admin、org_admin、ops 选项

### 3.6 前端 useAuth.ts 改动

1. **更新 `inferRoleFromCapabilities`**：适配新的分类体系
2. **新增 `getUserTier()` 方法**：返回 'user' | 'dev' | 'ops' | 'superadmin'

### 3.7 前端开发者后台改动

- DevSidebar / DevBottomNav：根据 `dev:project_admin` 和 `dev:org_manage` 能力动态显示/隐藏"成员管理"菜单项
- DevOrganizationsView：组织管理操作（添加/移除成员）需要 `dev:org_manage` 能力
- DevProjectDetailView：项目成员管理需要 `dev:project_admin` 能力

## 四、实施步骤

### Step 1: 创建数据库迁移文件
- 文件：`backend/migrations/0028_restructure_capability_categories.sql`
- 内容：新增能力、迁移授权数据、删除旧能力、更新 category 和 sort_index

### Step 2: 更新后端 capabilities.ts
- 更新 ALL_CAPABILITIES（删除 member_manage，新增 project_admin 和 org_manage，更新所有 category 和 sort_index）
- 更新 ROLE_TEMPLATES（新增 project_admin/org_admin/ops 模板）
- 新增 grantDefaultUserCapabilities() 函数

### Step 3: 更新后端 API 路由
- 将 `dev:member_manage` 替换为 `dev:project_admin` 或 `dev:org_manage`
- 检查所有使用 `dev:member_manage` 的端点并正确拆分

### Step 4: 更新后端注册/登录流程
- 找到用户创建的代码位置
- 在首次创建用户时调用 grantDefaultUserCapabilities()

### Step 5: 更新前端 CapabilityEditor.vue
- 实现三级折叠展示（大类 → 小类 → 具体能力）
- 更新中文标签
- 添加视觉区分
- 更新角色模板选项

### Step 6: 更新前端 useAuth.ts
- 更新 inferRoleFromCapabilities()
- 新增 getUserTier() 方法

### Step 7: 更新前端开发者后台
- DevSidebar/DevBottomNav 根据能力动态显示菜单
- 组织/项目成员管理页面添加能力校验

### Step 8: 部署验证
- 上传所有修改文件
- 执行数据库迁移
- 重建 Docker 后端镜像
- 构建前端并部署
- 验证权限系统正常

## 五、发散思考 — 未来可扩展方向

### 5.1 权限申请工作流
用户可以在个人中心申请"开发者"权限，填写申请理由，运维在后台审批。审批通过后自动授予权限。

### 5.2 权限自动提权
- 提交项目被批准 → 自动获得 dev:project_edit + dev:project_admin（作为项目 owner）
- 创建组织被批准 → 自动获得 dev:org_manage（作为组织 owner）
- 加入组织 → 不自动获得 dev:org_manage，只有 owner/admin 才有
- 这些已在 rolePromotion.ts 中部分实现，需要更新为新的能力 ID

### 5.3 组织内角色与能力的联动
当用户在组织中被提升为 admin 时，可以考虑自动授予 `dev:org_manage` 能力；被降级为 member 时收回。这需要在组织成员角色变更时触发。

### 5.4 项目转让场景
项目 owner 转让项目时，原 owner 变为 collaborator，新 owner 获得 `dev:project_admin` 的实际操作权（不需要修改 capability，因为校验是基于 project_members 表的 role 字段）。

### 5.5 权限组/权限包
除了单条能力，可以定义"权限包"（如"项目管理者包"= dev:project_edit + dev:project_admin + dev:stats_view），运维可以一键授权整个包。

### 5.6 权限有效期
某些临时权限（如"活动期间审核员"）可以设置过期时间，到期自动收回。

### 5.7 权限变更通知
当用户权限被修改时，发送站内通知，告知用户新获得或失去的权限。

### 5.8 前端路由守卫细化
当前路由守卫只检查 `admin_panel_access` 和 `dev_panel_access`，可以进一步细化到每个子页面检查具体能力，防止有部分运维权限的用户看到无权限的页面。
