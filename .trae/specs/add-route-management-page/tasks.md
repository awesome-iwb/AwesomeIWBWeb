# Tasks

- [x] Task 1: 数据库迁移 — 创建 pages 表
  - [x] SubTask 1.1: 在 `backend/migrations/` 下新建迁移文件 `0033_create_pages.sql`
  - [x] SubTask 1.2: 编写 SQL 创建 `pages` 表（id, path, title, description, group, icon, required_capability, is_visible, sort_index, created_at, updated_at）
  - [x] SubTask 1.3: 插入初始路由数据（从现有前端路由配置中提取）

- [x] Task 2: 后端服务 — 创建 pages 服务
  - [x] SubTask 2.1: 创建 `backend/src/services/pages.ts`，实现 list/create/update/remove/sync 函数
  - [x] SubTask 2.2: sync 函数从硬编码的路由列表中读取，与数据库对比后 upsert
  - [x] SubTask 2.3: 同时支持 DB 模式和 JSON 模式

- [x] Task 3: 后端 API — 注册路由端点
  - [x] SubTask 3.1: 在 `backend/src/index.ts` 中新增 5 个 API 端点（GET/POST/PUT/DELETE/sync）
  - [x] SubTask 3.2: 在 `backend/src/apiRegistry.ts` 中注册 5 个 API
  - [x] SubTask 3.3: 在 `backend/src/services/capabilities.ts` 中新增 `route:manage` 权限

- [x] Task 4: 前端路由和导航 — 添加路由管理入口
  - [x] SubTask 4.1: 在 `frontend/src/router/index.ts` 中新增 `/admin/routes` 路由
  - [x] SubTask 4.2: 在 `frontend/src/views/admin/AdminLayout.vue` 中新增"路由管理"导航项

- [x] Task 5: 前端页面 — 创建 RoutesView.vue
  - [x] SubTask 5.1: 创建 `frontend/src/views/admin/RoutesView.vue`，使用 ListDetailLayout
  - [x] SubTask 5.2: 列表区域：按分组显示路由，支持分组筛选和搜索
  - [x] SubTask 5.3: 详情区域：编辑表单（标题、备注、分组、图标、权限、可见性、排序）
  - [x] SubTask 5.4: 同步路由按钮：调用 sync API 并刷新列表
  - [x] SubTask 5.5: 手机端适配：使用胶囊化列表交互

- [x] Task 6: 构建验证
  - [x] SubTask 6.1: 运行 `vite build` 确保无编译错误
  - [x] SubTask 6.2: 运行 `vue-tsc --noEmit` 确保无类型错误

# Task Dependencies
- Task 1 和 Task 2 可并行
- Task 3 依赖 Task 2
- Task 4 和 Task 5 可并行
- Task 5 依赖 Task 3
- Task 6 依赖所有其他 Task
