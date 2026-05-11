# Tasks

- [x] Task 1: 扩展后端能力清单，新增 admin_panel_access、dev_panel_access、comment:manage 能力
  - [x] 更新 capabilities.ts 中的 ALL_CAPABILITIES 数组
  - [x] 创建数据库迁移 0015_add_panel_access_capabilities.sql，向 capabilities 表插入新能力
  - [x] 为现有 ops 角色用户自动授予所有能力（数据迁移脚本）

- [x] Task 2: 改造后端权限中间件，废弃 requireRole
  - [x] 在 auth.ts 中将 requireRole 标记为 @deprecated
  - [x] 确保 requireCapability 和 checkCap 覆盖所有新增能力
  - [x] 审查 index.ts 中所有 checkCap 调用，确保能力 ID 与新清单一致

- [x] Task 3: 改造前端路由守卫，从 requiresRole 切换到 requiresCapability
  - [x] 修改 router/index.ts，将 requiresRole: 'ops' 改为 requiresCapability: 'admin_panel_access'
  - [x] 将 requiresRole: 'dev' 改为 requiresCapability: 'dev_panel_access'
  - [x] 修改 setupRouterGuard 函数，使用 hasCapability 替代 role 比较

- [x] Task 4: 替换前端所有 role 硬编码为 hasCapability 调用
  - [x] NavBar.vue: role === 'ops' → hasCapability('admin_panel_access')，role === 'dev' → hasCapability('dev_panel_access')
  - [x] MeView.vue: 同上替换后台入口按钮的 v-if 条件，roleLabel 改为基于能力推断
  - [x] CommentPanel.vue: role === 'dev' || role === 'ops' → hasCapability('comment:manage')
  - [x] AdminView.vue: 用户管理中移除角色三选一按钮，保留能力勾选器

- [x] Task 5: 改造 AdminView 用户管理界面
  - [x] 移除"普通用户/开发者/运维"角色切换按钮
  - [x] 添加 role 显示标签（根据能力自动推断：有 admin_panel_access 显示"运维"，有 dev_panel_access 显示"开发者"，否则"用户"）
  - [x] 确保能力勾选器完整展示所有能力（含新增的 admin_panel_access、dev_panel_access、comment:manage）

- [x] Task 6: 更新前端 useAuth 类型和能力推断逻辑
  - [x] AuthUser.role 类型保留但添加注释说明仅作显示
  - [x] 新增 inferRoleFromCapabilities 辅助函数：根据能力列表推断显示标签
  - [x] fetchUser 时自动根据能力推断 role 显示值

- [x] Task 7: 验证构建和类型检查
  - [x] 前端 npm run build 通过
  - [x] 确认所有 role 硬编码已替换
  - [x] 确认路由守卫使用能力检查

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 1]
- [Task 5] depends on [Task 4]
- [Task 6] depends on [Task 4]
- [Task 7] depends on [Task 2, Task 3, Task 4, Task 5, Task 6]
