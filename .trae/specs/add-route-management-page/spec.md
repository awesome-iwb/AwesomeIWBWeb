# 路由管理页面 Spec

## Why
当前网站的所有前端路由和导航项都是硬编码在源码中的，运维人员无法在运行时查看、备注或管理这些路由页面。需要一个路由管理页面，让运维人员可以在后台统一查看和管理域名下的所有路由页面，添加备注说明，并了解每个路由的权限要求。

## What Changes
- 新增 `pages` 数据库表，存储路由页面的元数据（路径、标题、备注、分组、权限要求、是否可见等）
- 新增后端 CRUD API：`/api/admin/pages`（GET/POST/PUT/DELETE）
- 新增前端管理页面 `RoutesView.vue`，使用 ListDetailLayout 展示路由列表和详情
- 在 AdminLayout 的侧边栏中添加"路由管理"导航项，归类在运维权限类目下
- 新增权限 `route:manage`，归类在 `ops.system` 类目
- 支持自动扫描前端路由配置，将现有路由同步到数据库（初始化/手动触发）
- 手机端和桌面端均可正常使用

## Impact
- Affected code:
  - `backend/src/index.ts` — 新增 4 个 API 端点
  - `backend/src/services/pages.ts` — 新增页面管理服务
  - `backend/src/apiRegistry.ts` — 注册新 API
  - `backend/migrations/` — 新增迁移文件
  - `backend/src/services/capabilities.ts` — 新增 `route:manage` 权限
  - `frontend/src/router/index.ts` — 新增 `/admin/routes` 路由
  - `frontend/src/views/admin/AdminLayout.vue` — 新增导航项
  - `frontend/src/views/admin/RoutesView.vue` — 新增管理页面
- Affected specs: refine-capability-system（新增一个权限）

## ADDED Requirements

### Requirement: 路由页面数据模型
系统 SHALL 提供 `pages` 表存储路由页面元数据。

#### Scenario: 数据表结构
- **WHEN** 系统初始化
- **THEN** `pages` 表包含以下字段：
  - `id` UUID 主键
  - `path` TEXT NOT NULL UNIQUE — 路由路径（如 `/admin/users`）
  - `title` TEXT NOT NULL — 页面标题（如"用户权限"）
  - `description` TEXT DEFAULT '' — 备注/说明
  - `group` TEXT DEFAULT '' — 分组（如"运维"、"开发者"、"公开"）
  - `icon` TEXT DEFAULT '' — 图标名称（lucide icon name）
  - `required_capability` TEXT DEFAULT '' — 所需权限（如 `user:read`）
  - `is_visible` BOOLEAN DEFAULT true — 是否在导航中可见
  - `sort_index` INTEGER DEFAULT 0 — 排序序号
  - `created_at` TIMESTAMPTZ
  - `updated_at` TIMESTAMPTZ

### Requirement: 路由页面 CRUD API
系统 SHALL 提供路由页面的增删改查 API。

#### Scenario: 获取路由列表
- **WHEN** 运维人员发送 `GET /api/admin/pages`
- **THEN** 返回所有路由页面列表，按 `sort_index` 排序
- **AND** 支持按 `group` 筛选

#### Scenario: 创建路由页面
- **WHEN** 运维人员发送 `POST /api/admin/pages` 并提供 path、title 等字段
- **THEN** 创建新的路由页面记录
- **AND** 如果 path 已存在则返回 409

#### Scenario: 更新路由页面
- **WHEN** 运维人员发送 `PUT /api/admin/pages/:id` 并提供更新字段
- **THEN** 更新指定路由页面记录

#### Scenario: 删除路由页面
- **WHEN** 运维人员发送 `DELETE /api/admin/pages/:id`
- **THEN** 删除指定路由页面记录

#### Scenario: 同步前端路由
- **WHEN** 运维人员发送 `POST /api/admin/pages/sync`
- **THEN** 系统扫描前端路由配置（从 apiRegistry 或硬编码列表），将新路由插入 pages 表，已存在的路由更新 title/capability 等字段，不删除手动添加的记录

### Requirement: 路由管理前端页面
系统 SHALL 在运维后台提供路由管理页面。

#### Scenario: 桌面端列表-详情布局
- **WHEN** 运维人员在桌面端访问 `/admin/routes`
- **THEN** 左侧显示路由列表（按分组归类），右侧显示选中路由的详情编辑表单
- **AND** 列表项显示路径、标题、分组标签、权限标签
- **AND** 详情表单可编辑标题、备注、分组、图标、权限、是否可见、排序

#### Scenario: 手机端列表-胶囊布局
- **WHEN** 运维人员在手机端访问 `/admin/routes`
- **THEN** 列表全屏展示，选中路由后列表收缩为胶囊，详情全屏展示
- **AND** 底栏导航中包含路由管理入口

#### Scenario: 同步路由按钮
- **WHEN** 运维人员点击"同步路由"按钮
- **THEN** 调用 `/api/admin/pages/sync` 接口
- **AND** 成功后刷新列表，显示新增和更新的路由数量

#### Scenario: 分组筛选
- **WHEN** 运维人员选择分组筛选器
- **THEN** 列表只显示该分组下的路由页面

### Requirement: 路由管理权限
系统 SHALL 将路由管理权限归类在运维类目下。

#### Scenario: 权限定义
- **WHEN** 系统初始化权限列表
- **THEN** 包含 `route:manage` 权限，归类在 `ops.system`，名称为"路由管理"
- **AND** 只有拥有此权限的用户才能访问 `/admin/routes` 页面和相关 API

#### Scenario: 导航项可见性
- **WHEN** 用户没有 `route:manage` 权限
- **THEN** 侧边栏和底栏中不显示"路由管理"导航项

## MODIFIED Requirements

### Requirement: AdminLayout 导航项
在 AdminLayout 的 sidebarItems 中新增一项：
```ts
{ key: 'routes', label: '路由管理', to: '/admin/routes', icon: Route, group: 'secondary', primary: false, cap: 'route:manage' }
```
放置在"审计日志"和"数据分析"之间。

### Requirement: capabilities.ts 权限列表
在 `ALL_CAPABILITIES` 的 `ops.system` 类目中新增：
```ts
{ id: 'route:manage', name: '路由管理', category: 'ops.system', description: '管理网站路由页面', sortIndex: 55 }
```

### Requirement: apiRegistry.ts
新增 5 个 API 注册项：
```ts
{ id: 'admin.pages.list', method: 'GET', path: '/api/admin/pages', scope: 'admin' },
{ id: 'admin.pages.create', method: 'POST', path: '/api/admin/pages', scope: 'admin' },
{ id: 'admin.pages.update', method: 'PUT', path: '/api/admin/pages/:id', scope: 'admin' },
{ id: 'admin.pages.delete', method: 'DELETE', path: '/api/admin/pages/:id', scope: 'admin' },
{ id: 'admin.pages.sync', method: 'POST', path: '/api/admin/pages/sync', scope: 'admin' },
```

## REMOVED Requirements
无移除项。
