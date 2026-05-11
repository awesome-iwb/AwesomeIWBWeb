# 后端管理现代化 — 用户增删改 + 密码管理 Spec

## Why
当前超级管理员无法在后台创建用户、删除用户或管理用户密码，只能通过第三方登录被动创建用户。需要让超级管理员像正常运营网站一样，直接在后台完成用户全生命周期管理。

## What Changes
- **新增创建用户 API 和 UI**：超级管理员可在后台直接创建用户（用户名 + 可选密码 + 可选邮箱）
- **新增删除用户 API 和 UI**：超级管理员可删除用户（超级管理员自身不可删除）
- **新增重置密码 API 和 UI**：超级管理员可为任何有本地账号的用户重置密码，也可为 Casdoor 用户创建本地登录密码
- **新增 `user:delete` 能力**：细粒度控制删除用户权限
- **前端 AdminView 用户管理区域增加操作按钮**：创建用户、删除用户、重置密码

## Impact
- Affected code: `backend/src/index.ts`, `backend/src/services/users.ts`, `backend/src/services/localAccounts.ts`, `backend/src/services/capabilities.ts`, `frontend/src/views/AdminView.vue`
- Affected DB: 新增 `user:delete` 能力到 capabilities 表

## ADDED Requirements

### Requirement: 超级管理员创建用户
系统 SHALL 允许超级管理员（拥有 `user:manage` 能力）在后台直接创建用户。

#### Scenario: 创建仅用户名的用户
- **WHEN** 超级管理员提交用户名（必填），不填密码和邮箱
- **THEN** 系统创建一个 `role=user`、`is_active=true` 的用户，无本地账号（只能通过 Casdoor 登录）

#### Scenario: 创建带密码的用户
- **WHEN** 超级管理员提交用户名和密码
- **THEN** 系统创建用户并同时在 `local_accounts` 表中创建对应的本地账号，该用户可通过密码登录

#### Scenario: 用户名已存在
- **WHEN** 超级管理员提交的用户名已被占用
- **THEN** 返回 409 错误 "Username already exists"

#### Scenario: 密码强度不足
- **WHEN** 超级管理员提交的密码不符合强度要求（≥8位，含小写字母，含数字）
- **THEN** 返回 400 错误 "Password does not meet requirements"

### Requirement: 超级管理员删除用户
系统 SHALL 允许拥有 `user:delete` 能力的用户删除其他用户。

#### Scenario: 删除普通用户
- **WHEN** 管理员点击删除用户并确认
- **THEN** 系统删除该用户及其所有关联数据（user_capabilities CASCADE），返回成功

#### Scenario: 删除超级管理员自身
- **WHEN** 管理员尝试删除超级管理员账号
- **THEN** 返回 403 错误 "Cannot delete superadmin"

#### Scenario: 删除自己
- **WHEN** 管理员尝试删除自己的账号
- **THEN** 返回 403 错误 "Cannot delete yourself"

### Requirement: 超级管理员重置用户密码
系统 SHALL 允许拥有 `user:manage` 能力的用户为其他用户设置或重置密码。

#### Scenario: 为已有本地账号的用户重置密码
- **WHEN** 管理员为已有本地账号的用户设置新密码
- **THEN** 系统更新 `local_accounts` 中的密码哈希，设置 `must_change_password=true`，清零 `failed_attempts` 和 `locked_until`

#### Scenario: 为 Casdoor 用户创建本地登录密码
- **WHEN** 管理员为没有本地账号的用户设置密码
- **THEN** 系统在 `local_accounts` 表中创建新记录（username=用户名，role=用户当前 role），该用户此后也可通过密码登录

#### Scenario: 密码强度不足
- **WHEN** 管理员提交的密码不符合强度要求
- **THEN** 返回 400 错误 "Password does not meet requirements"

#### Scenario: 为超级管理员重置密码
- **WHEN** 管理员为超级管理员设置密码
- **THEN** 允许操作（超级管理员密码可被其他管理员重置）

### Requirement: user:delete 能力
系统 SHALL 新增 `user:delete` 能力到能力清单中。

#### Scenario: 能力列表包含 user:delete
- **WHEN** 查询所有能力列表
- **THEN** 包含 `{ id: "user:delete", name: "删除用户", category: "user", description: "删除用户账号", sort_index: 1650 }`

## MODIFIED Requirements

### Requirement: AdminView 用户管理区域
原用户管理区域只有"启用/禁用"和"权限勾选"。修改为：新增"创建用户"按钮（在用户列表顶部）、"删除用户"按钮（在用户详情底部，红色危险操作）、"重置密码"按钮（在用户详情中，与启用/禁用并列）。

### Requirement: 用户列表筛选
原角色筛选使用 `role` 字段（user/dev/ops）。由于角色现在由能力推断，保留此筛选但添加说明。
