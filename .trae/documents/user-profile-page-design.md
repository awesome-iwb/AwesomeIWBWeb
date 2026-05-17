# 用户个人主页设计方案

## 背景

当前系统只有 `/me`（自己的个人中心），不存在公开的用户资料页。用户在评论中只显示名称和头像，无法点击查看该用户的更多信息。需要设计一个公开的用户个人主页，展示该用户的评论和基本信息。

## 核心设计决策

### 用户名唯一 + 支持改名

- 将 `users.name` 添加 UNIQUE 约束，禁止重名
- 新增改名功能，用户可以在 `/me` 页面修改自己的用户名（需要 `user:rename` 权限）
- 运维可以在运维后台修改任意用户的用户名（需要 `user:manage` 权限，已有）
- 改名后自动级联更新 `feedback_entries.actor_username` 和 `feedback_replies.actor_username` 中的历史记录
- 路由直接使用 `/u/:name`，无需额外 slug 字段
- 改名后旧链接失效，不做重定向（简单实现）

### 权限设计

**新增 capability**：`user:rename`（修改用户名）

| capability | 类别 | 说明 | 归属角色模板 |
|---|---|---|---|
| `user:rename` | `user.personal` | 修改自己的用户名 | user、developer、project_admin、org_admin |

- `user:rename` 属于用户权限类别 `user.personal`，与 `user:profile`、`user:avatar` 同组
- 所有包含用户权限的角色模板（user/developer/project_admin/org_admin）都自动拥有此权限
- 运维通过 `user:manage` 权限可以修改**任意**用户的用户名，不受 30 天频率限制

**两条改名路径**：

| 路径 | API | 权限 | 频率限制 | 范围 |
|---|---|---|---|---|
| 用户自己改名 | `PATCH /api/user/name` | `user:rename` | 30天1次 | 只能改自己 |
| 运维改名 | `PATCH /api/admin/users/:id/name` | `user:manage` | 无限制 | 改任意用户 |

### 隐私控制

**公开信息**：
- 用户名（name）
- 头像（avatar_url）
- 角色标签（用户/开发者/运维）
- 参与的项目列表
- 所属组织列表
- 发表的公开评论（已通过审核的）

**不公开**：
- 邮箱、STCN 账号、casdoor_id、各种平台 ID
- 后台权限详情
- 审核中的评论
- Bug 反馈

## 路由设计

| 路由 | 页面 | 说明 |
|------|------|------|
| `/u/:name` | UserProfileView | 用户公开主页 |
| `/me` | MeView（不变） | 自己的个人中心 |

- `/me` 是管理页（改头像、改用户名、登录、退出）
- `/u/:name` 是公开展示页，任何人可查看
- 评论区的用户名/头像可点击跳转到 `/u/:name`
- 自己访问 `/u/自己的名字` 时，顶部提示"这是你的公开主页"并附带"编辑资料"按钮跳转到 `/me`
- 路由注册位置：在 `/me` 路由之后、`/project/:name` 之前，确保不被通配符 `/:pathMatch(.*)*` 吞掉

## 页面结构

### UserProfileView.vue — 三个 Tab

**头部区域**：
- 头像（大尺寸 80px）+ 用户名 + 角色标签（用户/开发者/运维，用不同颜色徽章）
- 统计行：参与项目数 · 所属组织数 · 加入时间
- 如果是自己，显示"编辑资料"按钮（跳转 `/me`）

**评论 Tab**（默认）：
- 该用户在公开项目下的已审核评论（kind=comment）
- 每条评论显示：内容 + 来自哪个项目（可点击跳转 `/project/:name`）+ 时间
- 分页（每页 20 条）

**项目 Tab**：
- 该用户参与的项目卡片列表
- 每个项目显示：图标 + 名称 + 描述摘要
- 标注角色（负责人/协作者）

**组织 Tab**：
- 该用户所属的组织卡片列表
- 每个组织显示：头像 + 名称 + 描述
- 标注角色（所有者/管理员/成员）

**404 处理**：
- 如果用户名不存在，显示友好的 404 页面（而非跳转到全局 404）

## 后端 API

### 新增端点

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/users/:name/profile` | 获取用户公开资料 | 公开 |
| GET | `/api/users/:name/comments` | 获取用户公开评论（分页） | 公开 |
| GET | `/api/users/:name/projects` | 获取用户参与的项目 | 公开 |
| GET | `/api/users/:name/organizations` | 获取用户所属组织 | 公开 |
| PATCH | `/api/user/name` | 修改自己的用户名 | `user:rename` |
| PATCH | `/api/admin/users/:id/name` | 运维修改任意用户的用户名 | `user:manage` |

### GET /api/users/:name/profile 返回

```json
{
  "name": "张三",
  "avatar_url": "https://...",
  "role_label": "开发者",
  "project_count": 3,
  "organization_count": 1,
  "joined_at": "2026-01-15T08:00:00Z"
}
```

- `role_label`：根据用户 capabilities 推断，优先级 ops > dev > user
- `project_count`：从 project_members 统计
- `organization_count`：从 organization_members 统计
- 用户不存在返回 404

### GET /api/users/:name/comments 返回

```json
{
  "items": [
    {
      "id": "uuid",
      "project_name": "my-project",
      "body": "评论内容",
      "created_at": "2026-05-15T10:00:00Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 42
}
```

- 只返回 kind=comment 且 moderation 已通过（或无 moderation 记录）的条目
- 按 created_at DESC 排序
- 支持 `?page=1&pageSize=20` 分页

### GET /api/users/:name/projects 返回

```json
[
  {
    "project_name": "my-project",
    "display_name": "My Project",
    "icon_url": "https://...",
    "description": "项目描述",
    "role": "owner"
  }
]
```

- 从 project_members JOIN projects 获取
- role: owner / member

### GET /api/users/:name/organizations 返回

```json
[
  {
    "id": "uuid",
    "name": "组织名",
    "slug": "org-slug",
    "avatar_url": "https://...",
    "description": "组织描述",
    "role": "owner"
  }
]
```

- 从 organization_members JOIN organizations 获取
- 只返回 status=approved 的组织
- role: owner / admin / member

### PATCH /api/user/name — 用户自己改名

请求体：
```json
{ "name": "新用户名" }
```

校验规则：
- 需要 `user:rename` 权限
- 2-30 个字符
- 只允许中文、英文、数字、下划线、连字符：`/^[\p{L}\p{N}_-]{2,30}$/u`
- 不能与已有用户重名（大小写不敏感检查）
- 改名后级联更新：
  - `feedback_entries.actor_username` WHERE actor_username = old_name
  - `feedback_replies.actor_username` WHERE actor_username = old_name
- 改名频率限制：30 天内只能改一次（查 user_name_changes 表）
- 改名成功后 bump token_version（强制重新登录获取新 JWT）
- 返回新的用户信息

### PATCH /api/admin/users/:id/name — 运维改名

请求体：
```json
{ "name": "新用户名" }
```

校验规则：
- 需要 `user:manage` 权限
- 2-30 个字符
- 只允许中文、英文、数字、下划线、连字符：`/^[\p{L}\p{N}_-]{2,30}$/u`
- 不能与已有用户重名（大小写不敏感检查）
- 改名后级联更新 feedback_entries 和 feedback_replies
- **无 30 天频率限制**（运维操作不受此约束）
- 写入 user_name_changes 记录（标注操作来源为 admin）
- bump token_version
- 记录审计日志

## 数据库变更

### 迁移 0029：users.name 添加 UNIQUE 约束

```sql
-- 1. 处理现有重复用户名（同名用户加数字后缀）
WITH duplicates AS (
  SELECT id, name,
    ROW_NUMBER() OVER (PARTITION BY lower(name) ORDER BY created_at ASC) as rn
  FROM users
)
UPDATE users SET name = d.name || '_' || (d.rn - 1)::text
FROM duplicates d
WHERE users.id = d.id AND d.rn > 1;

-- 2. 添加唯一约束
ALTER TABLE users ADD CONSTRAINT users_name_unique UNIQUE (name);
```

### 迁移 0030：新增 user_name_changes 表 + user:rename capability

```sql
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

-- 新增 user:rename capability
INSERT INTO capabilities (id, name, category, description, sort_index) VALUES
  ('user:rename', '修改用户名', 'user.personal', '修改自己的用户名', 220);

-- 为所有已有用户授予 user:rename 权限（与 user:profile/user:avatar 同组）
INSERT INTO user_capabilities (user_id, capability_id)
  SELECT uc.user_id, 'user:rename'
  FROM user_capabilities uc
  WHERE uc.capability_id = 'user:profile'
ON CONFLICT (user_id, capability_id) DO NOTHING;
```

- `source` 字段：`self`（用户自己改）或 `admin`（运维改）
- `changed_by` 字段：运维改名时记录操作者 ID，自己改名时为 NULL

## 前端改动

### 新增文件
- `frontend/src/views/UserProfileView.vue` — 用户公开主页

### 修改文件
- `frontend/src/router/index.ts` — 添加 `/u/:name` 路由
- `frontend/src/components/CommentPanel.vue` — 评论中的用户名/头像可点击跳转到 `/u/:name`
- `frontend/src/api/endpoints.ts` — 添加用户公开资料 API 端点 + 运维改名端点
- `frontend/src/views/MeView.vue` — 添加"修改用户名"功能（需 `user:rename` 权限）
- `frontend/src/views/admin/UsersView.vue` — 添加"修改用户名"功能（需 `user:manage` 权限）
- `frontend/src/composables/useAuth.ts` — 改名后更新本地用户状态
- `backend/src/services/capabilities.ts` — 新增 `user:rename` capability + 更新角色模板

### CommentPanel 改动细节

评论区的用户名和头像变为可点击链接：
- 将 `<div class="font-extrabold">{{ e.author }}</div>` 改为 `<router-link :to="'/u/' + encodeURIComponent(e.author)" class="font-extrabold hover:text-emerald-600">{{ e.author }}</router-link>`
- 头像同理，用 `<router-link>` 包裹
- 回复中的用户名也做同样处理

### MeView 改动细节

在个人信息卡片中添加"修改用户名"入口：
- 只有拥有 `user:rename` 权限时才显示修改按钮
- 在"头像来源"行下方新增"用户名"行，显示当前用户名 + "修改"按钮
- 点击"修改"后显示输入框 + 确认/取消按钮
- 校验规则提示（2-30字符，仅中文/英文/数字/下划线/连字符）
- 30天内只能改一次的提示（从 API 返回的错误信息中展示）
- 改名成功后调用 `fetchUser()` 刷新本地状态

### UsersView（运维后台）改动细节

在用户详情页的权限管理区域上方，添加"修改用户名"功能：
- 在用户名显示处添加"修改"按钮
- 点击后显示输入框 + 确认/取消
- 调用 `PATCH /api/admin/users/:id/name`
- 运维改名不受 30 天频率限制
- 改名成功后刷新用户列表和详情

### capabilities.ts 改动细节

在 `ALL_CAPABILITIES` 数组中新增：
```typescript
{ id: "user:rename", name: "修改用户名", category: "user.personal", description: "修改自己的用户名", sort_index: 220 },
```

在所有包含 `user:profile` 的角色模板中添加 `"user:rename"`：
- user、developer、project_admin、org_admin

## 实施步骤（10 步）

### Step 1：数据库迁移
- 创建 `backend/migrations/0029_users_name_unique.sql` — 处理重复用户名 + UNIQUE 约束
- 创建 `backend/migrations/0030_user_name_changes.sql` — user_name_changes 表 + user:rename capability + 授权

### Step 2：后端 — capabilities 更新
- 在 `backend/src/services/capabilities.ts` 的 `ALL_CAPABILITIES` 中添加 `user:rename`
- 在所有包含 `user:profile` 的角色模板中添加 `"user:rename"`

### Step 3：后端 — 用户公开资料 API
- 在 `backend/src/services/users.ts` 中新增：
  - `getUserPublicProfile(name: string)` — 返回公开资料
  - `getUserPublicComments(name: string, page, pageSize)` — 返回已审核评论
  - `getUserPublicProjects(name: string)` — 返回参与项目
  - `getUserPublicOrganizations(name: string)` — 返回所属组织
- 在 `backend/src/index.ts` 中注册 4 个 GET 端点

### Step 4：后端 — 用户自己改名 API
- 在 `backend/src/services/users.ts` 中新增 `renameUser(userId, newName, changedBy?, source?)`：
  - 校验格式、唯一性
  - 如果 source=self，检查 30 天频率限制
  - 级联更新 feedback_entries 和 feedback_replies
  - 写入 user_name_changes 记录
  - bump token_version
- 在 `backend/src/index.ts` 中注册 PATCH `/api/user/name` 端点（需 `user:rename` 权限）

### Step 5：后端 — 运维改名 API
- 在 `backend/src/index.ts` 中注册 PATCH `/api/admin/users/:id/name` 端点（需 `user:manage` 权限）
- 复用 `renameUser` 函数，source='admin'，无频率限制
- 记录审计日志

### Step 6：前端 — 路由 + API 端点
- `frontend/src/router/index.ts`：在 `/me` 之后添加 `/u/:name` 路由
- `frontend/src/api/endpoints.ts`：添加 6 个新端点（4 公开 + 2 改名）

### Step 7：前端 — UserProfileView.vue
- 创建用户公开主页组件
- 头部区域：头像 + 用户名 + 角色标签 + 统计 + 编辑按钮
- 三个 Tab：评论/项目/组织
- 加载状态、空状态、404 处理

### Step 8：前端 — CommentPanel 用户名/头像可点击
- 评论区的 author 名称和头像用 `<router-link>` 包裹
- 回复区的 actor_username 同理

### Step 9：前端 — MeView + UsersView 修改用户名
- MeView：在个人信息卡片中添加用户名显示和修改入口（需 `user:rename` 权限）
- UsersView：在运维用户详情中添加修改用户名功能（需 `user:manage` 权限）
- 改名成功后刷新状态

### Step 10：测试 + 修复
- 后端测试：公开资料 API、用户改名 API（校验、级联更新、频率限制、权限检查）、运维改名 API
- 前端手动测试：个人主页显示、评论点击跳转、用户改名流程、运维改名流程
