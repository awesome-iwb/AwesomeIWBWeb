# 细粒度用户权限系统重构 Spec

## Why
当前权限系统存在根本性设计缺陷：三级角色（user/dev/ops）是全有全无的粗粒度模型，无法为每位用户单独配置权限。角色字段同时决定了用户能看到哪个后台入口、能执行哪些操作，导致运维人员被迫拥有所有权限，而普通用户无法获得任何管理能力。需要彻底废弃角色驱动的权限模型，改为纯能力（capability）驱动的权限系统。

## What Changes
- **BREAKING**: 废弃 `role` 字段作为权限判断依据，`role` 仅保留为显示标签
- **BREAKING**: 废弃前端路由守卫中的 `requiresRole` 机制，改为基于能力的路由守卫
- **BREAKING**: 废弃后端 `requireRole()`、`checkOps()` 等基于角色的中间件
- 新增 `admin_panel_access` 能力，决定用户能否看到/进入运维后台
- 新增 `dev_panel_access` 能力，决定用户能否看到/进入开发者后台
- 细化现有能力清单，覆盖所有用户可执行操作
- 前端所有 `role === 'ops'` / `role === 'dev'` 硬编码替换为 `hasCapability()` 调用
- 后端所有基于角色的权限检查替换为 `requireCapability()` / `checkCap()`
- AdminView 用户管理中移除角色按钮，仅保留能力勾选器
- MeView 中后台入口按钮改为基于能力显示

## Impact
- Affected specs: 用户认证、路由守卫、管理后台、个人中心
- Affected code:
  - `backend/src/plugins/auth.ts` — AuthUser 类型、requireRole 函数
  - `backend/src/services/capabilities.ts` — 能力清单扩展
  - `backend/src/index.ts` — 所有 checkCap 调用需审查
  - `frontend/src/composables/useAuth.ts` — AuthUser 类型、hasCapability
  - `frontend/src/router/index.ts` — 路由守卫逻辑
  - `frontend/src/views/AdminView.vue` — 用户管理权限编辑器
  - `frontend/src/views/MeView.vue` — 后台入口按钮
  - `frontend/src/components/NavBar.vue` — 导航栏后台入口
  - `frontend/src/components/CommentPanel.vue` — 评论管理权限

## ADDED Requirements

### Requirement: 能力驱动的后台入口
系统 SHALL 根据用户拥有的能力决定其能看到和进入哪个后台入口，而非根据 role 字段。

#### Scenario: 用户拥有 admin_panel_access 能力
- **WHEN** 用户拥有 `admin_panel_access` 能力
- **THEN** 导航栏和个人中心显示"运维后台"入口按钮
- **AND** 用户可以访问 `/admin` 路由

#### Scenario: 用户拥有 dev_panel_access 能力
- **WHEN** 用户拥有 `dev_panel_access` 能力
- **THEN** 导航栏和个人中心显示"开发者后台"入口按钮
- **AND** 用户可以访问 `/dev` 路由

#### Scenario: 用户没有任何后台能力
- **WHEN** 用户既没有 `admin_panel_access` 也没有 `dev_panel_access`
- **THEN** 不显示任何后台入口按钮
- **AND** 访问 `/admin` 或 `/dev` 路由时重定向到个人中心

### Requirement: 完整的能力清单
系统 SHALL 提供以下细粒度能力，覆盖所有用户可执行操作：

| 类别 | 能力 ID | 说明 |
|------|---------|------|
| 后台 | `admin_panel_access` | 访问运维后台 |
| 后台 | `dev_panel_access` | 访问开发者后台 |
| 项目 | `project:read` | 查看项目列表和详情 |
| 项目 | `project:create` | 创建/提交新项目 |
| 项目 | `project:update` | 编辑项目信息 |
| 项目 | `project:delete` | 删除项目 |
| 项目 | `project:rollback` | 回滚项目到历史版本 |
| 项目 | `project:import` | 批量导入数据 |
| 项目 | `project:export` | 批量导出数据 |
| 分类 | `category:manage` | 增删改分类 |
| 提交 | `submission:read` | 查看项目提交列表 |
| 提交 | `submission:approve` | 批准项目提交 |
| 提交 | `submission:reject` | 驳回项目提交 |
| 审核 | `moderation:read` | 查看内容审核队列 |
| 审核 | `moderation:approve` | 批准评论或 Bug 反馈 |
| 审核 | `moderation:reject` | 驳回评论或 Bug 反馈 |
| 用户 | `user:read` | 查看用户列表 |
| 用户 | `user:manage` | 修改用户角色、状态、权限 |
| 审计 | `audit:read` | 查看系统审计日志 |
| 故事 | `story:manage` | 管理首页故事 |
| 反馈 | `feedback:manage` | 管理反馈状态和标签 |
| 评论 | `comment:manage` | 管理自己和他人的评论/Issue 状态 |

#### Scenario: 超级管理员自动拥有所有能力
- **WHEN** 用户是超级管理员（如 lincube）
- **THEN** 该用户自动拥有所有能力，且不可在后台被修改

#### Scenario: 普通用户默认无管理能力
- **WHEN** 新用户注册
- **THEN** 该用户默认没有任何管理能力，仅能进行公共操作（浏览项目、发评论等）

### Requirement: 运维后台可视化权限编辑器
系统 SHALL 在运维后台的用户管理页面提供可视化权限编辑器，允许管理员为每位用户逐项勾选或取消能力。

#### Scenario: 管理员编辑用户权限
- **WHEN** 管理员在用户管理页面选择一个非超级管理员用户
- **THEN** 显示按类别分组的权限勾选列表
- **AND** 每个能力显示名称和描述
- **AND** 提供全选/清空按钮
- **AND** 保存后立即生效

#### Scenario: 管理员尝试修改超级管理员权限
- **WHEN** 管理员选择超级管理员用户
- **THEN** 显示"此用户拥有所有权限，不可修改"提示
- **AND** 不显示权限勾选列表

### Requirement: 前端路由守卫基于能力
系统 SHALL 使用能力检查替代角色检查来保护前端路由。

#### Scenario: 用户访问需要特定能力的页面
- **WHEN** 用户访问 `/admin` 路由
- **THEN** 路由守卫检查用户是否拥有 `admin_panel_access` 能力
- **AND** 若无该能力则重定向到个人中心

## MODIFIED Requirements

### Requirement: 用户角色字段仅作显示标签
`role` 字段 SHALL 仅用于前端显示（如"运维"、"开发者"、"用户"标签），不再参与任何权限判断逻辑。后端 `AuthUser.role` 类型保留但不再用于 `requireRole()` 等权限检查函数。

### Requirement: 后端权限中间件统一使用 requireCapability
所有后端 API 路由的权限保护 SHALL 统一使用 `requireCapability()` 或 `checkCap()` 函数，不再使用 `requireRole()`。`requireRole()` 函数标记为废弃但暂时保留以避免破坏性变更。

### Requirement: 前端权限检查统一使用 hasCapability
所有前端组件中的权限判断 SHALL 统一使用 `useAuth().hasCapability()` 方法，不再直接比较 `user.role`。

## REMOVED Requirements

### Requirement: 基于角色的路由守卫
**Reason**: 角色不应决定用户能访问哪些页面，能力才应该。`requiresRole` 路由元信息将被 `requiresCapability` 替代。
**Migration**: 路由 meta 中的 `requiresRole: 'ops'` 改为 `requiresCapability: 'admin_panel_access'`，`requiresRole: 'dev'` 改为 `requiresCapability: 'dev_panel_access'`。

### Requirement: AdminView 中的角色切换按钮
**Reason**: 角色不再决定权限，保留角色按钮会给用户造成误解。用户权限完全由能力勾选器控制。
**Migration**: 移除"普通用户/开发者/运维"三选一按钮，仅保留能力勾选器。`role` 字段根据用户拥有的能力自动推断显示标签。
