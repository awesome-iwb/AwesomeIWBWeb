# Tasks

- [x] Task 1: 修复 OAuth State 验证 — 从内存 Map 改为 HMAC 签名验证
  - [x] SubTask 1.1: 修改 `casdoorAuth.ts`，删除 `stateStore` Map 和 `cleanOldStates` 函数
  - [x] SubTask 1.2: 修改 `encodeStateCookie`，在 payload 中加入 `createdAt` 时间戳
  - [x] SubTask 1.3: 修改 `decodeStateCookie`，验证 HMAC 签名后检查 `createdAt` 是否在 10 分钟内
  - [x] SubTask 1.4: 修改 `/api/auth/callback` 路由，删除 `stateStore.get(state)` 检查，仅依赖 cookie 中的签名验证
  - [x] SubTask 1.5: 修改 `/api/auth/login` 路由，删除 `stateStore.set(state, ...)` 调用，仅设置 cookie
  - [x] SubTask 1.6: 验证登录流程正常工作

- [x] Task 2: Casdoor 登录回调时提取并持久化 STCN 字段
  - [x] SubTask 2.1: 修改 `casdoorAuth.ts` callback 路由，从 Casdoor 用户信息中提取 `stcn_user_id`（`account.id`）和 `stcn_username`（`account.name`）
  - [x] SubTask 2.2: 在 `createUser` 调用中传入 `stcn_user_id` 和 `stcn_username`
  - [x] SubTask 2.3: 在 `updateUserLogin` 调用中传入 `stcn_user_id` 和 `stcn_username`

- [x] Task 3: 数据库迁移 — 删除 sectl_user_id/lincube_user_id，新增 hzzc_user_id
  - [x] SubTask 3.1: 创建迁移文件 `0016_drop_sectl_lincube_add_hzzc.sql`
  - [x] SubTask 3.2: 删除 `sectl_user_id` 列和索引
  - [x] SubTask 3.3: 删除 `lincube_user_id` 列
  - [x] SubTask 3.4: 新增 `hzzc_user_id TEXT` 列和索引

- [x] Task 4: 后端服务层更新 — 移除 sectl/lincube，添加 hzzc
  - [x] SubTask 4.1: 修改 `users.ts` User 类型：删除 `sectl_user_id`/`lincube_user_id`，添加 `hzzc_user_id`
  - [x] SubTask 4.2: 修改 `createUser` 函数：替换 sectl/lincube 为 hzzc
  - [x] SubTask 4.3: 修改 `updateUserLogin` 函数：替换 sectl/lincube 为 hzzc
  - [x] SubTask 4.4: 修改所有 SQL 查询中的列名
  - [x] SubTask 4.5: 修改 `normalizeProjectInput.ts`：替换 sectl/lincube 为 hzzc
  - [x] SubTask 4.6: 修改 `casdoorAuth.ts` /api/auth/me 返回值：替换 sectl/lincube 为 hzzc

- [x] Task 5: 前端类型和 UI 更新
  - [x] SubTask 5.1: 修改 `useAuth.ts` AuthUser 类型：删除 `sectl_user_id`/`lincube_user_id`，添加 `hzzc_user_id`
  - [x] SubTask 5.2: 修改 `useAuth.ts` setToken/fetchUser 中的字段映射
  - [x] SubTask 5.3: 修改 `MeView.vue`：移除 sectl 相关显示，添加 hzzc 相关显示
  - [x] SubTask 5.4: 修改 `AdminView.vue`：替换 sectl/lincube 为 hzzc
  - [x] SubTask 5.5: 修改 `DevView.vue`：替换 sectl/lincube 为 hzzc
  - [x] SubTask 5.6: 修改 `friendLinks.ts`：删除 sectl 条目

- [x] Task 6: 部署到服务器并验证
  - [x] SubTask 6.1: Git commit & push
  - [x] SubTask 6.2: 服务器 SFTP 上传 + 重新构建 + 重启
  - [x] SubTask 6.3: 验证 STCN 登录流程正常

# Task Dependencies
- [Task 2] depends on [Task 1] (state 修复后才能正常测试登录回调)
- [Task 4] depends on [Task 3] (数据库迁移先执行)
- [Task 5] depends on [Task 4] (前端类型跟随后端变更)
- [Task 6] depends on [Task 1, Task 2, Task 3, Task 4, Task 5] (所有改动完成后部署)
