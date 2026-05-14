# 管理后台重构 — 设计规格书

日期: 2026-05-14

## 问题陈述

当前管理后台（`AdminView.vue`，2000+ 行）存在以下问题：

1. **无权限驱动的 UI 控制**：所有 7 个 Tab 对所有管理员可见，无论其能力如何。用户能看到无法使用的按钮。
2. **单体架构**：单个 Vue 文件包含所有管理功能，难以维护和扩展。
3. **无总览看板**：无法一眼看到系统状态。
4. **伪图床缺乏管理**：媒体 Tab 仅支持查看和软删除，无标签、搜索、批量操作、引用关系可视化。
5. **移动端体验是事后补充**：移动端布局是桌面端的压缩版，非专门设计。
6. **双重权限模型混乱**：基于角色（`user`/`dev`/`ops`）和基于能力（26 个 Capability）共存，`requireRole()` 已废弃但仍存在。

## 设计决策

### 架构：嵌套路由 + 侧边栏

用嵌套路由架构替换单页 Tab 布局：

```
/admin                    → AdminLayout.vue（侧边栏 + 顶栏壳）
  /admin/dashboard        → DashboardView.vue
  /admin/stories          → StoriesView.vue
  /admin/projects         → ProjectsView.vue
  /admin/submissions      → SubmissionsView.vue
  /admin/moderation       → ModerationView.vue
  /admin/feedback         → FeedbackView.vue
  /admin/users            → UsersView.vue
  /admin/media            → MediaView.vue（增强版）
  /admin/audit            → AuditView.vue
```

每个模块是 `frontend/src/views/admin/` 下的独立 Vue 组件。

### 权限模型：Capability + 角色模板

保留 26 个细粒度 Capability 作为权限的真实来源。新增 4 种预设角色模板用于快速分配：

| 模板 | 包含的 Capability |
|------|------------------|
| **超级管理员** | 全部 26 个 Capability（`SUPERADMIN_INITIAL_USERNAME` 自动拥有） |
| **审核员** | `admin_panel_access`, `submission:read`, `submission:approve`, `submission:reject`, `moderation:read`, `moderation:approve`, `moderation:reject`, `feedback:manage`, `comment:manage` |
| **编辑** | `admin_panel_access`, `story:manage`, `project:read`, `project:create`, `project:update`, `category:manage`, `media:read`, `media:manage` |
| **开发者** | `dev_panel_access`, `project:read`, `submission:read` |

角色模板仅为 UI 便利功能——预填充 Capability 复选框。应用模板后，管理员仍可手动微调各项能力。

### 侧边栏权限映射

每个侧边栏项需要一个特定 Capability。用户缺少该能力时隐藏对应项：

| 侧边栏项 | 所需 Capability | 图标 |
|----------|----------------|------|
| 总览 | `admin_panel_access` | LayoutDashboard |
| 文章管理 | `story:manage` | FileText |
| 项目管理 | `project:read` | Package |
| 项目审核 | `submission:read` | ClipboardCheck |
| 内容审核 | `moderation:read` | Shield |
| 评论反馈 | `feedback:manage` | MessageSquare |
| 用户权限 | `user:read` | Users |
| 图床管理 | `media:read` | Image |
| 审计日志 | `audit:read` | ScrollText |

总览页在用户拥有 `admin_panel_access` 时始终可见。

### 登录：保留双入口

- **API Token 登录**：在 `/dontusejy` 页面输入 Token，存储在内存中，以 Bearer Header 发送
- **Casdoor/本地密码登录**：标准 OAuth 流程或密码登录，基于 Session Cookie
- 两种方式进入同一个管理后台布局；能力由认证用户的 `user_capabilities` 表决定

## 组件设计

### AdminLayout.vue

共享布局壳，包含：

- **桌面端（≥1024px）**：固定左侧边栏（可折叠）+ 顶栏 + 内容区
- **移动端（<1024px）**：顶栏 + 内容区 + 固定底部可滚动导航栏
- 侧边栏/底部导航项按用户能力过滤
- 顶栏显示：当前用户名、「返回首页」按钮、「退出」按钮

### DashboardView.vue

总览页以卡片形式展示关键指标。卡片根据用户能力动态显示。

| 卡片 | 所需 Capability | 数据 |
|------|----------------|------|
| 项目总数 / 本周新增 | `project:read` | 项目数量 + 增量 |
| 待审核提交 | `submission:read` | 待审核提交数 |
| 待审核内容 | `moderation:read` | 待审核评论 + Bug 数 |
| 待处理反馈 | `feedback:manage` | 待处理反馈数 |
| 用户总数 / 本周注册 | `user:read` | 用户数量 + 增量 |
| 媒体资产数 / 存储占用 | `media:read` | 资产数量 + 总大小 |
| 文章数 | `story:manage` | 文章数量 |

卡片下方：最近活动流（最近 10 条审计日志，需 `audit:read` 能力）。

**新增后端 API**：`GET /api/admin/dashboard` — 返回所有看板数据，按请求用户的能力过滤。

### UsersView.vue（增强版）

用户列表 + 详情面板，包含：

1. **角色模板选择器**：下拉菜单应用预设模板
2. **折叠式能力编辑器**：Capability 按分类分组（面板、项目、分类、提交、审核、用户、审计、故事、反馈、评论、媒体）。每个分类可折叠：
   - 分类标题显示 ✅/☐ 表示该组是否有任何能力被启用
   - 点击展开查看各项能力的复选框
   - 选择角色模板时自动填充所有复选框，管理员可再微调
3. **超级管理员标识**：如果用户是超级管理员，显示"拥有全部权限"徽章，禁止编辑

### MediaView.vue（增强版）

伪图床的新功能：

1. **标签系统**：
   - 新增 `media_tags` 表：`media_id (uuid)`, `tag (text)`，复合主键
   - 新增 API：`PATCH /api/admin/media/:id/tags` — 替换媒体资产的标签
   - 标签以 Chip 形式显示在每个媒体项上，带内联"添加标签"输入框

2. **搜索与过滤**：
   - 过滤条件：文本搜索（URL/文件名）、标签、MIME 类型、状态（active/deleted）、上传者
   - 现有 `listMediaAssets` 扩展 `tag` 过滤参数

3. **引用关系可视化**：
   - 每个媒体项显示引用计数（来自 `media_references` 表）
   - 点击展开引用列表：实体类型、实体 ID、字段路径
   - 引用计数 > 0 且用户尝试删除时显示警告徽章

4. **批量操作**：
   - 媒体列表上的复选框多选
   - 「批量打标签」按钮：打开对话框为选中项添加/移除标签
   - 「批量删除」按钮：软删除所有选中项（带引用计数警告）
   - 新增 API：`POST /api/admin/media/batch-tag`, `POST /api/admin/media/batch-delete`

### 其他模块视图

AdminView.vue 中的每个现有 Tab 变为独立的视图组件：

- `StoriesView.vue` — 从当前文章 Tab 提取
- `ProjectsView.vue` — 从当前项目 Tab 提取
- `SubmissionsView.vue` — 从当前审核 Tab 提取
- `ModerationView.vue` — 从当前内容审核 Tab 提取
- `FeedbackView.vue` — 包装现有 `CommentPanel` 组件
- `AuditView.vue` — 从当前审计弹窗提取（提升为完整页面）

## 后端变更

### 新增 API

| 方法 | 路径 | 所需 Capability | 说明 |
|------|------|----------------|------|
| GET | `/api/admin/dashboard` | 按卡片不同 | 看板汇总数据 |
| PATCH | `/api/admin/media/:id/tags` | `media:manage` | 更新媒体标签 |
| POST | `/api/admin/media/batch-tag` | `media:manage` | 批量打标签 |
| POST | `/api/admin/media/batch-delete` | `media:manage` | 批量软删除媒体 |

### 新增数据库表

```sql
CREATE TABLE media_tags (
  media_id UUID NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (media_id, tag)
);
CREATE INDEX idx_media_tags_tag ON media_tags(tag);
```

### 修改的 API

- `GET /api/admin/media` — 新增 `tag` 查询参数用于过滤
- `GET /api/admin/dashboard` — 新端点，返回按用户能力过滤的汇总统计

### 角色模板存储

角色模板在代码中定义（非数据库），作为 `capabilities.ts` 中的常量：

```typescript
export const ROLE_TEMPLATES = {
  superadmin: { name: "超级管理员", capabilityIds: getAllCapabilityIds() },
  reviewer: { name: "审核员", capabilityIds: ["admin_panel_access", "submission:read", ...] },
  editor: { name: "编辑", capabilityIds: ["admin_panel_access", "story:manage", ...] },
  developer: { name: "开发者", capabilityIds: ["dev_panel_access", "project:read", ...] },
};
```

这避免了数据库迁移，且模板随代码版本控制。

## 前端文件结构

```
frontend/src/
  views/admin/
    AdminLayout.vue          ← 侧边栏 + 顶栏壳
    DashboardView.vue        ← 总览看板
    StoriesView.vue          ← 文章管理
    ProjectsView.vue         ← 项目管理
    SubmissionsView.vue      ← 项目审核
    ModerationView.vue       ← 内容审核
    FeedbackView.vue         ← 评论反馈
    UsersView.vue            ← 用户权限管理
    MediaView.vue            ← 增强版图床管理
    AuditView.vue            ← 审计日志
  components/admin/
    AdminSidebar.vue         ← 侧边栏导航（桌面端）
    AdminBottomNav.vue       ← 底部导航（移动端）
    DashboardCard.vue        ← 指标卡片组件
    CapabilityEditor.vue     ← 折叠式能力编辑器
    MediaTagInput.vue        ← 标签输入/Chip 组件
    MediaBatchActions.vue    ← 批量操作工具栏
```

## 迁移策略

1. 创建 `AdminLayout.vue`，包含侧边栏和嵌套 `<router-view />`
2. 更新路由：`/admin` 变为使用 `AdminLayout` 的父路由，添加子路由
3. 将 AdminView.vue 中的每个 Tab 提取为独立视图组件
4. 为侧边栏项添加基于能力的可见性控制
5. 构建 `DashboardView.vue` 和后端看板 API
6. 构建增强版 `MediaView.vue`（标签、搜索、批量操作）
7. 构建增强版 `UsersView.vue`（角色模板 + 折叠式能力编辑器）
8. 删除旧 `AdminView.vue`
9. 从后端移除已废弃的 `requireRole()` / `requireAuthOrDev()`

步骤 1-4 是核心迁移，步骤 5-7 是新增功能，步骤 8-9 是清理。

## 不在范围内

- API Token 能力分配（Token 保持 `ops` 角色）
- 开发者后台（`/dev`）重构（单独项目）
- 移除 `users.role` 列（过渡期保留向后兼容）
- 看板实时通知（未来增强）
