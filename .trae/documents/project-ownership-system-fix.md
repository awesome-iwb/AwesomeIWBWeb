# 项目所属系统彻底修复计划

## 问题概述

当前项目的开发者/组织归属系统存在严重的双重体系混乱和数据断裂：

1. **双重归属体系未统一** — `projects.developer`（纯文本）与 `developer_user_id`（FK）并存；`organization_id`（单组织FK）与 `project_members`（多对多）并存
2. **运维后台** — 开发者选择器只能选一个，组织选择器初始标签丢失，SearchSelect 不响应切换
3. **开发者后台** — 开发者字段是纯文本输入，无组织选择器，无成员管理 UI
4. **公开首页** — 组织名称永远为空（后端不返回）
5. **开发者管理页** — 组织成员显示 UUID 而非用户名

## 设计原则

### 核心数据模型：一个项目 = 一个主要开发者 + 一个所属组织 + N个协作者

```
projects 表:
  developer_user_id  →  主要开发者（项目创建者/负责人，单人）
  organization_id    →  所属组织（项目归属的组织，单个或空）

project_members 表:
  多个协作者（user_id 或 org_id，role = owner/collaborator）
```

- `developer` 纯文本字段保留用于**显示**，但由系统从 `developer_user_id` 自动同步
- `organization_id` 是"这个项目属于哪个组织"，project_members 中的 org 是"哪些组织参与了"
- 协作者通过 project_members 管理，与 developer_user_id/organization_id 是互补关系

### 三层权限 × 双后台的职责划分

| 操作 | 运维后台 (ops) | 开发者后台 (dev) |
|------|---------------|-----------------|
| 设置主要开发者 | ✅ `project:update` | ❌ 不可自行更改 |
| 设置所属组织 | ✅ `project:update` | ✅ `dev:org_manage`（仅限自己所属组织） |
| 添加/移除协作者 | ✅ `project:update` | ✅ `dev:project_admin`（仅限自己的项目） |
| 转让所有权 | ❌ | ✅ `dev:project_admin`（owner→其他成员） |
| 编辑项目信息 | ✅ `project:update` | ✅ `dev:project_edit` |

---

## 修复步骤

### Phase 1: 修复 SearchSelect 组件 + 后端数据补全

**1.1 修复 SearchSelect.vue — 响应 modelValue/initialLabel 变化**

当前 `initialLabel` 只在 `onMounted` 时读取，切换项目后标签不更新。

修复方案：添加 `watch` 监听 `modelValue` 和 `initialLabel`，当 `modelValue` 变为 null 时清空显示，当 `initialLabel` 变化时更新显示标签。

**1.2 后端 getCatalog() 返回 organization_name**

修改 `projects.ts` 的 `getCatalog()` 函数，LEFT JOIN organizations 表返回 `organization_name`。

**1.3 后端 listProjects() 返回 organization_name + developer_user_name**

修改 `projects.ts` 的 `listProjects()` 函数，LEFT JOIN organizations 和 users 表。

**1.4 后端 GET /api/projects/:name 返回 organization_name**

修改公开项目详情 API，返回组织名称。

**1.5 后端 getOrganizationMembers 返回用户名和头像**

修改组织成员查询，JOIN users 表返回 `user_name` 和 `user_avatar_url`。

### Phase 2: 运维后台项目编辑页修复

**2.1 修复 Admin ProjectsView — 组织 SearchSelect 初始标签**

当选中项目时，从项目数据中获取 `organization_name` 并传递给 SearchSelect。由于 1.3 修复后列表接口会返回 `organization_name`，这个问题自动解决。

**2.2 修复 Admin ProjectsView — 开发者 SearchSelect 初始标签**

同上，列表接口返回 `developer_user_name` 后自动解决。

**2.3 Admin ProjectsView — 添加协作者管理区域**

在项目编辑表单底部新增"项目成员"区域：
- 显示当前成员列表（头像+名称+角色标签）
- "添加成员"按钮 → SearchSelect 搜索用户
- "移除"按钮（非 owner 可移除）
- 调用 `POST/DELETE /api/admin/projects/:id/members`

**2.4 Admin ProjectsView — 选中开发者/组织后同步名称**

开发者 SearchSelect 添加 `@update:model-value` 回调同步 `developer` 文本和 `developer_user_name`。
组织 SearchSelect 添加 `@update:model-value` 回调同步 `organization_name`。

### Phase 3: 开发者后台项目详情页修复

**3.1 Dev ProjectDetailView — 替换开发者文本输入为只读显示**

`developer` 字段改为只读显示（项目的主要开发者不应由开发者自行更改，需运维操作）。

**3.2 Dev ProjectDetailView — 新增所属组织选择器**

添加组织 SearchSelect，仅显示当前用户所属的组织（通过 `GET /api/dev/organizations` 获取），需要 `dev:org_manage` 能力才可修改。

**3.3 Dev ProjectDetailView — 新增成员管理区域**

- 显示当前成员列表
- "邀请协作者"按钮 → SearchSelect 搜索用户（需 `dev:project_admin` 能力）
- "移除"按钮（非 owner，需 `dev:project_admin` 能力）
- "转让所有权"按钮（owner→其他成员，需 `dev:project_admin` 能力）
- 调用 `POST/DELETE /api/dev/projects/:id/members`

**3.4 后端 PATCH /api/dev/projects/:id 支持 organization_id**

当前只允许更新 name/description 等字段，需要新增 `organization_id` 字段的更新权限，且校验用户必须是该组织的成员。

### Phase 4: 开发者管理页修复 + 首页修复

**4.1 Admin DevelopersView — 修复组织成员显示 UUID**

后端 1.5 修复后，成员数据会包含 `user_name` 和 `user_avatar_url`，前端改为显示用户名和头像。

**4.2 HomeView — 显示组织名称**

后端 1.2 修复后，项目数据会包含 `organization_name`，修改 `getOrg()` 函数优先使用 `organization_name`。

**4.3 Dev ProjectsView — 显示组织信息**

项目卡片增加组织名称显示。

### Phase 5: 部署验证

上传所有修改文件 → 重建后端 → 构建前端 → 部署 → 验证。

---

## 文件修改清单

| 文件 | 修改类型 | Phase |
|------|----------|-------|
| `frontend/src/components/admin/SearchSelect.vue` | 添加 watch 响应变化 | 1.1 |
| `backend/src/services/projects.ts` | getCatalog/listProjects 返回 org_name+dev_name | 1.2, 1.3 |
| `backend/src/services/organizations.ts` | getOrganizationMembers 返回用户名 | 1.5 |
| `backend/src/index.ts` | 公开项目详情返回 org_name | 1.4 |
| `frontend/src/views/admin/ProjectsView.vue` | 成员管理+名称同步 | 2.1-2.4 |
| `frontend/src/views/dev/DevProjectDetailView.vue` | 组织选择+成员管理 | 3.1-3.3 |
| `backend/src/index.ts` | Dev PATCH 支持 organization_id | 3.4 |
| `frontend/src/views/admin/DevelopersView.vue` | 成员显示修复 | 4.1 |
| `frontend/src/views/HomeView.vue` | 组织名称显示 | 4.2 |
| `frontend/src/views/dev/DevProjectsView.vue` | 组织信息显示 | 4.3 |

## 风险与注意事项

1. **SearchSelect watch 需避免循环更新** — watch modelValue 时需要判断是否真的变化了
2. **Dev 面板组织选择需校验** — 用户只能将项目关联到自己所属的组织
3. **成员管理 API 权限** — 运维后台用 `project:update`，开发者后台用 `dev:project_admin`
4. **数据一致性** — 修改 `developer_user_id` 时必须同步更新 `developer` 文本字段
5. **向后兼容** — `developer` 纯文本字段继续保留，用于不支持 FK 查询的场景
