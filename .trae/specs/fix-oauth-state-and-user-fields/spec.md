# 修复 OAuth State 错误 + 用户字段重构 Spec

## Why
后端报错 `{"error":"Invalid or expired state"}`，导致 STCN 登录回调失败。根本原因是 OAuth state 存储在进程内存中，后端重启后丢失。同时需要重构用户字段：删除 `sectl_user_id` 和 `lincube_user_id`，保留 `stcn_user_id`/`stcn_username`，新增 `hzzc_user_id`，并从 Casdoor 用户信息中正确提取和持久化这些字段。

## What Changes
- **修复 state 验证**：将 OAuth state 从内存 Map 改为 HMAC 签名验证，不再依赖进程内存，后端重启后 state cookie 仍可验证
- **删除 sectl_user_id 和 lincube_user_id**：从数据库、后端服务、前端类型和 UI 中移除
- **新增 hzzc_user_id**：数据库迁移添加字段，后端服务和前端类型同步更新
- **从 Casdoor 用户信息提取 stcn_user_id 和 stcn_username**：登录回调时将 Casdoor 返回的 `id` 写入 `stcn_user_id`，`name` 写入 `stcn_username`，并持久化到数据库
- **前端 friendLinks 保留 stcn 和 hzzc**：删除 sectl 友链

## Impact
- Affected code: `backend/src/plugins/casdoorAuth.ts`, `backend/src/services/users.ts`, `backend/src/domain/normalizeProjectInput.ts`, `frontend/src/composables/useAuth.ts`, `frontend/src/views/MeView.vue`, `frontend/src/views/AdminView.vue`, `frontend/src/views/DevView.vue`, `frontend/src/content/friendLinks.ts`
- **BREAKING**: 数据库迁移删除 `sectl_user_id` 和 `lincube_user_id` 列，新增 `hzzc_user_id` 列

## ADDED Requirements

### Requirement: HMAC-based OAuth State 验证
系统 SHALL 使用 HMAC 签名验证 OAuth state，而非内存 Map。state cookie 中包含签名后的 state 值，回调时验证签名即可，无需进程内存。

#### Scenario: 后端重启后回调仍可验证
- **WHEN** 用户在 Casdoor 完成登录，后端在用户登录期间重启
- **THEN** 回调时 state cookie 中的 HMAC 签名仍可验证通过，登录成功

#### Scenario: 篡改的 state 被拒绝
- **WHEN** 攻击者修改了 state cookie 中的 state 值
- **THEN** HMAC 签名验证失败，返回 400 错误

### Requirement: 新增 hzzc_user_id 用户字段
系统 SHALL 在用户表和用户类型中支持 `hzzc_user_id` 字段。

#### Scenario: 数据库迁移
- **WHEN** 执行数据库迁移
- **THEN** `users` 表新增 `hzzc_user_id TEXT` 列和对应索引

### Requirement: Casdoor 登录时提取并持久化 STCN 字段
系统 SHALL 在 Casdoor 登录回调时，从用户信息中提取 `stcn_user_id`（Casdoor `id`）和 `stcn_username`（Casdoor `name`），并写入数据库。

#### Scenario: 新用户首次登录
- **WHEN** 新用户通过 STCN Casdoor 首次登录
- **THEN** `stcn_user_id` 设为 Casdoor 返回的 `id`，`stcn_username` 设为 Casdoor 返回的 `name`

#### Scenario: 老用户再次登录
- **WHEN** 已有用户再次通过 STCN Casdoor 登录
- **THEN** `stcn_user_id` 和 `stcn_username` 更新为 Casdoor 最新返回的值

## MODIFIED Requirements

### Requirement: OAuth State 存储
原实现使用进程内存 `Map<string, { createdAt: number }>` 存储 state。修改为：state cookie 中包含 `{ state, codeVerifier, returnTo }` 的 HMAC 签名 payload，回调时仅验证签名和过期时间（10 分钟），不再依赖内存存储。同时保留 `cleanOldStates` 的逻辑替换为检查 cookie 中的时间戳。

### Requirement: 用户字段
原用户类型包含 `sectl_user_id` 和 `lincube_user_id`。修改为：删除这两个字段，新增 `hzzc_user_id`。保留 `stcn_user_id` 和 `stcn_username`。

## REMOVED Requirements

### Requirement: sectl_user_id 和 lincube_user_id
**Reason**: 不再需要 sectl 和 lincube 的用户 ID 关联
**Migration**: 数据库迁移删除这两列；前端类型和 UI 移除相关字段；后端服务移除相关参数

### Requirement: sectl 友链
**Reason**: 用户要求删除 sectl，保留 stcn 和 hzzc
**Migration**: 从 `friendLinks.ts` 中移除 key 为 `sectl` 的条目
