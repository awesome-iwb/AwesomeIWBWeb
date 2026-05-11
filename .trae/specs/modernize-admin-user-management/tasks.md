# Tasks

- [x] Task 1: 新增 `user:delete` 能力
  - [x] SubTask 1.1: 在 `capabilities.ts` 的 `ALL_CAPABILITIES` 数组中添加 `{ id: "user:delete", name: "删除用户", category: "user", description: "删除用户账号", sort_index: 1650 }`
  - [x] SubTask 1.2: 创建数据库迁移 `0017_add_user_delete_capability.sql`，向 `capabilities` 表插入新能力

- [x] Task 2: 后端 — 新增创建用户 API
  - [x] SubTask 2.1: 在 `users.ts` 中添加 `deleteUser(id: string)` 函数
  - [x] SubTask 2.2: 在 `users.ts` 中确认 `findUserByName` 已存在
  - [x] SubTask 2.3: 在 `index.ts` 中添加 `POST /api/admin/users` 路由
  - [x] SubTask 2.4: 路由需要 `user:manage` 能力检查
  - [x] SubTask 2.5: 用户名重复返回 409，密码弱返回 400

- [x] Task 3: 后端 — 新增删除用户 API
  - [x] SubTask 3.1: 在 `index.ts` 中添加 `DELETE /api/admin/users/:id` 路由
  - [x] SubTask 3.2: 路由需要 `user:delete` 能力检查
  - [x] SubTask 3.3: 不可删除超级管理员，不可删除自己
  - [x] SubTask 3.4: 调用 `deleteUser(id)`，记录审计日志

- [x] Task 4: 后端 — 新增重置密码 API
  - [x] SubTask 4.1: 在 `index.ts` 中添加 `PATCH /api/admin/users/:id/password` 路由
  - [x] SubTask 4.2: 路由需要 `user:manage` 能力检查
  - [x] SubTask 4.3: 查找目标用户，调用 `setLocalAccountPassword`
  - [x] SubTask 4.4: 密码弱返回 400，用户不存在返回 404
  - [x] SubTask 4.5: 记录审计日志

- [x] Task 5: 前端 — AdminView 用户管理 UI 更新
  - [x] SubTask 5.1: 在用户列表区域顶部添加"创建用户"按钮和表单
  - [x] SubTask 5.2: 创建用户表单提交后调用 `POST /api/admin/users`
  - [x] SubTask 5.3: 在用户详情区域添加"重置密码"按钮
  - [x] SubTask 5.4: 重置密码提交后调用 `PATCH /api/admin/users/:id/password`
  - [x] SubTask 5.5: 在用户详情区域底部添加"删除用户"按钮（红色危险操作）
  - [x] SubTask 5.6: 删除用户提交后调用 `DELETE /api/admin/users/:id`

- [x] Task 6: 部署到服务器并验证
  - [x] SubTask 6.1: Git commit & push
  - [x] SubTask 6.2: 服务器 SFTP 上传 + 重新构建 + 重启
  - [x] SubTask 6.3: 验证后端运行正常

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 1]
- [Task 5] depends on [Task 2, Task 3, Task 4]
- [Task 6] depends on [Task 1, Task 2, Task 3, Task 4, Task 5]
