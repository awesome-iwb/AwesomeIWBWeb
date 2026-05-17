# 运维后台开发者管理 + 项目关联选择器 Spec

## Why
运维后台缺少对开发者和组织的统一管理视图，无法便捷地查看开发者列表、管理其组织归属。同时项目编辑页的"开发者"字段是纯文本输入，无法关联到平台用户；项目也没有"所属组织"字段。需要新增开发者管理选项卡，并将项目编辑中的开发者和组织选择改为可搜索的下拉选择器。

## What Changes
- 运维后台侧边栏新增"开发者管理"选项卡，统一管理开发者和组织
- 项目编辑表单新增"所属组织"和"所属开发者"可搜索下拉选择器，替代纯文本输入
- 新建 `SearchSelect` 通用可搜索下拉组件
- 后端新增开发者列表 API（支持搜索）
- 后端组织列表 API 增加搜索关键词参数
- 后端 projects 表新增 `organization_id` 可空外键字段
- 后端项目创建/更新 API 支持 `organization_id` 和 `developer_user_id` 字段

## Impact
- Affected specs: refine-capability-system（新增 dev:developer_manage 能力）
- Affected code:
  - `backend/src/services/projects.ts` — ProjectRow 类型新增字段
  - `backend/src/services/organizations.ts` — listOrganizations 增加 q 参数
  - `backend/src/services/users.ts` — 新增 listDevelopers 函数
  - `backend/src/index.ts` — 新增 API 路由
  - `backend/migrations/` — 新增迁移文件
  - `frontend/src/components/admin/AdminSidebar.vue` — 新增菜单项
  - `frontend/src/views/admin/ProjectsView.vue` — 替换 developer 输入为 SearchSelect
  - `frontend/src/views/admin/DevelopersView.vue` — 新建
  - `frontend/src/components/admin/SearchSelect.vue` — 新建通用组件

## ADDED Requirements

### Requirement: 运维后台开发者管理选项卡
系统 SHALL 在运维后台侧边栏新增"开发者管理"选项卡，允许拥有 `dev:developer_manage` 能力的用户查看和管理开发者和组织。

#### Scenario: 查看开发者列表
- **WHEN** 用户点击"开发者管理"选项卡
- **THEN** 显示开发者列表，包含用户名、头像、所属组织、关联项目数、加入时间
- **AND** 支持按关键词搜索开发者
- **AND** 支持按组织筛选开发者

#### Scenario: 查看开发者详情
- **WHEN** 用户点击某个开发者
- **THEN** 显示开发者详情面板，包含其关联的项目列表和组织列表
- **AND** 可查看和修改其所属组织（添加/移除组织成员关系）

#### Scenario: 查看组织列表
- **WHEN** 用户在开发者管理页切换到"组织"子标签
- **THEN** 显示所有组织列表，包含名称、slug、状态、成员数、创建时间
- **AND** 支持按关键词搜索组织
- **AND** 支持按状态筛选（pending/approved/rejected/suspended）

#### Scenario: 审核组织申请
- **WHEN** 用户在组织列表中点击待审核组织的"通过"或"驳回"按钮
- **THEN** 系统更新组织状态，并通知组织创建者

### Requirement: SearchSelect 可搜索下拉组件
系统 SHALL 提供一个通用的可搜索下拉选择组件，用于从远程数据源中搜索和选择项目。

#### Scenario: 搜索和选择
- **WHEN** 用户在 SearchSelect 输入框中输入关键词
- **THEN** 组件调用搜索函数获取匹配选项，显示在下拉列表中
- **AND** 用户点击选项后，输入框显示选中项的标签
- **AND** 支持清空已选项

#### Scenario: 无搜索结果
- **WHEN** 搜索结果为空
- **THEN** 显示"无匹配结果"提示

#### Scenario: 初始加载
- **WHEN** 组件挂载且已有初始值
- **THEN** 显示初始值对应的标签

### Requirement: 项目编辑页所属组织选择
系统 SHALL 在项目编辑表单中新增"所属组织"可搜索下拉选择器，允许从已审核通过的组织中选择。

#### Scenario: 选择所属组织
- **WHEN** 用户在项目编辑页的"所属组织"下拉框中输入关键词
- **THEN** 系统搜索已审核通过（status=approved）的组织，显示匹配结果
- **AND** 用户选择后，项目的 `organization_id` 字段被设置为该组织的 ID

#### Scenario: 清空所属组织
- **WHEN** 用户清空"所属组织"选择
- **THEN** 项目的 `organization_id` 被设为 null

#### Scenario: 不选择组织
- **WHEN** 用户创建项目时不选择组织
- **THEN** 项目的 `organization_id` 为 null，项目为独立项目

### Requirement: 项目编辑页所属开发者选择
系统 SHALL 将项目编辑表单的"开发者"纯文本输入替换为"所属开发者"可搜索下拉选择器，允许从平台用户中选择。

#### Scenario: 选择所属开发者
- **WHEN** 用户在项目编辑页的"所属开发者"下拉框中输入关键词
- **THEN** 系统搜索用户列表，显示匹配结果（用户名 + 头像）
- **AND** 用户选择后，项目的 `developer_user_id` 字段被设置为该用户的 ID
- **AND** 项目的 `developer` 文本字段同步更新为该用户的用户名（保持向后兼容）

#### Scenario: 清空所属开发者
- **WHEN** 用户清空"所属开发者"选择
- **THEN** 项目的 `developer_user_id` 被设为 null

### Requirement: 后端开发者列表 API
系统 SHALL 提供开发者列表 API，支持搜索和分页。

#### Scenario: 搜索开发者
- **WHEN** 请求 `GET /api/admin/developers?q=xxx&page=1&pageSize=20`
- **THEN** 返回拥有 `dev_panel_access` 能力的用户列表
- **AND** 支持按用户名模糊搜索
- **AND** 每个用户包含其关联的组织和项目数量

### Requirement: 后端组织搜索增强
系统 SHALL 在现有组织列表 API 中增加关键词搜索参数。

#### Scenario: 按关键词搜索组织
- **WHEN** 请求 `GET /api/admin/organizations?q=xxx`
- **THEN** 返回名称或 slug 包含关键词的组织列表

### Requirement: projects 表新增 organization_id 和 developer_user_id 字段
系统 SHALL 在 projects 表中新增两个可空外键字段。

#### Scenario: 新增字段
- **WHEN** 执行数据库迁移
- **THEN** projects 表新增 `organization_id` (UUID, nullable, REFERENCES organizations(id)) 字段
- **AND** projects 表新增 `developer_user_id` (UUID, nullable, REFERENCES users(id)) 字段

#### Scenario: 项目创建时设置组织
- **WHEN** 创建项目时传入 `organization_id`
- **THEN** 系统将 `organization_id` 保存到 projects 表

#### Scenario: 项目更新时修改组织
- **WHEN** 更新项目时传入 `organization_id`
- **THEN** 系统更新 projects 表的 `organization_id` 字段

## MODIFIED Requirements

### Requirement: AdminSidebar 导航项
原侧边栏有 11 个导航项。新增"开发者管理"导航项，所需权限为 `dev:developer_manage`，位于"用户权限"和"图床管理"之间。

### Requirement: ProjectsView 项目编辑表单
原"作者 / 开发者"字段为纯文本 input。修改为：使用 SearchSelect 组件，从用户列表中搜索选择，选中后同时设置 `developer_user_id` 和 `developer`（用户名文本）。新增"所属组织"SearchSelect 字段，位于"所属开发者"下方。

### Requirement: 后端 listOrganizations 函数
原函数参数为 `{ status?, created_by?, page?, pageSize? }`。修改为新增 `q?` 参数，支持按名称和 slug 模糊搜索。

## REMOVED Requirements

### Requirement: 纯文本开发者输入
**Reason**: 开发者字段应关联到平台用户，而非自由文本。纯文本无法建立用户-项目关联关系。
**Migration**: 保留 `developer` 文本字段用于显示和向后兼容，但编辑时通过 SearchSelect 选择用户，自动填充 `developer` 为用户名。新增 `developer_user_id` 字段建立正式关联。
