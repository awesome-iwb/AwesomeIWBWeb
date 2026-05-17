# Tasks

- [x] Task 1: 数据库迁移 — projects 表新增 organization_id 和 developer_user_id 字段
  - [x] 创建迁移文件 `0029_add_project_org_and_dev_user.sql`
  - [x] 新增 `organization_id UUID NULL REFERENCES organizations(id) ON DELETE SET NULL`
  - [x] 新增 `developer_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL`
  - [x] 为已有项目回填：根据 project_members 中 org_id 最小的记录设置 organization_id；根据 developer 文本匹配用户名设置 developer_user_id

- [x] Task 2: 后端 — 组织搜索增强 + 开发者列表 API
  - [x] 修改 `organizations.ts` 的 `listOrganizations` 函数，增加 `q` 参数（按 name/slug 模糊搜索）
  - [x] 修改 `index.ts` 中 `GET /api/admin/organizations` 路由，传递 `q` 参数
  - [x] 新建 `developers.ts` 服务，实现 `listDevelopers` 函数（查询拥有 dev_panel_access 能力的用户，支持 q 搜索，包含关联组织和项目数量）
  - [x] 在 `index.ts` 中注册 `GET /api/admin/developers` 路由，需要 `dev:developer_manage` 能力

- [x] Task 3: 后端 — 项目 API 支持 organization_id 和 developer_user_id
  - [x] 修改 `projects.ts` 的 `ProjectRow` 类型，新增 `organization_id` 和 `developer_user_id` 字段
  - [x] 修改项目创建/更新逻辑，支持写入 `organization_id` 和 `developer_user_id`
  - [x] 修改项目查询逻辑，返回 `organization_id`、`developer_user_id` 以及关联的组织名称和用户名
  - [x] 修改 `GET /api/admin/projects/:id` 返回关联的组织信息和开发者信息

- [x] Task 4: 前端 — SearchSelect 通用可搜索下拉组件
  - [x] 创建 `SearchSelect.vue` 组件
  - [x] Props: `modelValue`, `searchFn` (搜索函数), `labelKey`, `valueKey`, `placeholder`, `clearable`
  - [x] 功能: 输入关键词 → 调用 searchFn → 显示下拉列表 → 点击选中 → 支持清空
  - [x] 支持初始值回显（传入 initialLabel）
  - [x] 样式: 与现有表单风格一致（圆角、暗色模式支持）

- [x] Task 5: 前端 — 项目编辑页集成 SearchSelect
  - [x] 在 `ProjectsView.vue` 中引入 SearchSelect 组件
  - [x] 替换"作者 / 开发者"纯文本 input 为 SearchSelect，搜索用户列表 API
  - [x] 新增"所属组织"SearchSelect，搜索已审核通过的组织列表 API
  - [x] 选中开发者后同步设置 `developer` 文本字段和 `developer_user_id`
  - [x] 选中组织后设置 `organization_id`
  - [x] 修改 `createNewProject` 初始化对象，新增 `organization_id: null` 和 `developer_user_id: null`

- [x] Task 6: 前端 — 运维后台开发者管理页面
  - [x] 创建 `DevelopersView.vue`，使用 FloatingPanel 布局
  - [x] 左侧列表: 开发者列表（搜索 + 分页），显示用户名、头像、组织、项目数
  - [x] 右侧内容: 开发者详情（关联项目、关联组织）+ 组织子标签（组织列表 + 审核）
  - [x] 组织审核功能: 通过/驳回按钮（复用现有 API）
  - [x] 在 `AdminSidebar.vue` 新增"开发者管理"菜单项，权限 `dev:developer_manage`
  - [x] 在 `router/index.ts` 新增 `/admin/developers` 路由

- [x] Task 7: 部署验证
  - [x] 上传所有修改文件到服务器
  - [x] 执行数据库迁移 0029
  - [x] 重建 Docker 后端
  - [x] 构建前端并部署
  - [x] 验证后端健康状态正常
  - [x] 验证数据库新字段存在

# Task Dependencies
- [Task 2] depends on [Task 1] (开发者列表 API 需要数据库字段存在)
- [Task 3] depends on [Task 1] (项目 API 需要新字段)
- [Task 5] depends on [Task 3] + [Task 4] (前端集成需要后端 API + 组件就绪)
- [Task 6] depends on [Task 2] (开发者管理页面需要开发者列表 API)
- [Task 7] depends on [Task 5] + [Task 6] (部署需要所有功能完成)
