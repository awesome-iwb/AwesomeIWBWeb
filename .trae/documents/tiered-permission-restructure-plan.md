# 三层权限系统重构 — 实施计划

## 概述

将现有39项能力的扁平分类重构为三层权限体系（用户/开发者/运维），拆分 `dev:member_manage` 为 `dev:project_admin` + `dev:org_manage`，新增角色模板，并更新前后端代码。

## 已完成

- ✅ Step 1: 迁移文件 `0028_restructure_capability_categories.sql` 已创建
- ✅ Step 2: `capabilities.ts` 已完全重写（ALL_CAPABILITIES 39→41项，ROLE_TEMPLATES 新增3个模板，新增 grantCapabilities + grantDefaultUserCapabilities）
- ✅ Step 3（部分）: `index.ts` 中 7 处 `dev:member_manage` 已替换完成

---

## 待执行步骤

### Step 3: 完成后端 API 路由更新（剩余部分）

**3a. 修复 `rolePromotion.ts`**

文件：`backend/src/services/rolePromotion.ts`

第7-11行 `DEV_CAPABILITY_IDS` 数组中，将 `"dev:member_manage"` 替换为 `"dev:project_admin", "dev:org_manage"`：

```ts
// 修改前
const DEV_CAPABILITY_IDS = [
  "dev_panel_access",
  "dev:project_edit", "dev:bug_manage", "dev:comment_manage",
  "dev:stats_view", "dev:member_manage",
];

// 修改后
const DEV_CAPABILITY_IDS = [
  "dev_panel_access",
  "dev:project_edit", "dev:bug_manage", "dev:comment_manage",
  "dev:stats_view", "dev:project_admin", "dev:org_manage",
];
```

**3b. 修复 `capabilities.test.ts`**

文件：`backend/src/services/capabilities.test.ts`

第21行测试用例引用 `dev:member_manage`，需替换为 `dev:project_admin` 和 `dev:org_manage`：

```ts
// 修改前
expect(ids).toContain('dev:member_manage');

// 修改后
expect(ids).toContain('dev:project_admin');
expect(ids).toContain('dev:org_manage');
```

同时更新第24-29行的 org/claim 测试，因为 `org:review`、`claim:review`、`org:manage` 的 category 已从扁平改为两级（但 id 不变，测试应仍通过）。需确认测试中 `org:review` 等仍然在 `getAllCapabilityIds()` 返回值中。

---

### Step 4: 更新后端注册/登录流程（新用户自动授予默认权限）

**4a. 在 Casdoor OAuth 回调中添加 `grantDefaultUserCapabilities` 调用**

文件：`backend/src/plugins/casdoorAuth.ts`

在第328-337行，新用户创建后（`else` 分支），添加调用：

```ts
} else {
  user = await createUser({
    casdoor_id: casdoorId,
    name,
    avatar_url: avatar,
    avatar_source: avatar ? "casdoor" : "default",
    email: email || null,
    role: "user",
    stcn_user_id: stcnUserId || null,
    stcn_username: stcnUsername || null,
  });
  // 新增：为新用户授予默认权限
  if (user) {
    const { grantDefaultUserCapabilities } = await import("../services/capabilities");
    await grantDefaultUserCapabilities(user.id);
  }
}
```

**4b. 在管理员创建用户时添加 `grantDefaultUserCapabilities` 调用**

文件：`backend/src/index.ts`

在第2139行 `createUser` 调用后，添加：

```ts
const created = await createUser({ name, email });
// 新增：为新用户授予默认权限
if (created) {
  const { grantDefaultUserCapabilities } = await import("./services/capabilities");
  await grantDefaultUserCapabilities(created.id);
}
```

---

### Step 5: 更新前端 CapabilityEditor.vue（三级折叠+中文标签+视觉区分）

文件：`frontend/src/components/admin/CapabilityEditor.vue`

**5a. 更新 `groupLabels` 为两级分类中文映射**

将现有的扁平 category 标签替换为新的两级分类标签：

```ts
const groupLabels: Record<string, string> = {
  'user.social': '用户 · 社交',
  'user.personal': '用户 · 个人',
  'user.contribute': '用户 · 贡献',
  'dev.access': '开发者 · 访问',
  'dev.project': '开发者 · 项目',
  'dev.project_admin': '开发者 · 项目管理',
  'dev.org': '开发者 · 组织',
  'dev.interact': '开发者 · 互动',
  'dev.data': '开发者 · 数据',
  'ops.access': '运维 · 访问',
  'ops.project': '运维 · 项目',
  'ops.review': '运维 · 审核',
  'ops.content': '运维 · 内容',
  'ops.system': '运维 · 系统',
};
```

**5b. 实现三级折叠展示**

修改 `groups` 计算属性，将能力按大类（user/dev/ops）→ 小类（social/personal/...）两级分组：

1. 顶层按大类分组（user/dev/ops），显示为可折叠的大标题
2. 每个大类下按小类分组，显示为子折叠项
3. 每个小类下列出具体能力

新增 `tierLabels` 映射和 `tierOrder` 排序：

```ts
const tierLabels: Record<string, string> = {
  user: '用户层',
  dev: '开发者层',
  ops: '运维层',
};

const tierOrder = ['user', 'dev', 'ops'];
```

**5c. 添加视觉区分**

- 用户层：绿色调（emerald）
- 开发者层：蓝色调（blue/indigo）
- 运维层：紫色调/红色调（purple/rose）

每个大类标题左侧添加颜色标识条。

**5d. 更新模板选项**

模板下拉菜单现在包含新的角色模板（project_admin、org_admin、ops），这些已由后端 ROLE_TEMPLATES 提供，前端无需额外修改（模板数据来自 API）。

---

### Step 6: 更新前端 useAuth.ts

文件：`frontend/src/composables/useAuth.ts`

**6a. 更新 `inferRoleFromCapabilities` 函数**

当前逻辑：`admin_panel_access` → ops，`dev_panel_access` → dev，否则 user。

新增更细粒度的推断：

```ts
function inferRoleFromCapabilities(capabilities: string[] | undefined, isSuperadmin: boolean | undefined): AuthRole {
  if (isSuperadmin) return 'ops';
  if (!capabilities) return 'user';
  if (capabilities.includes('admin_panel_access')) return 'ops';
  if (capabilities.includes('dev_panel_access')) return 'dev';
  return 'user';
}
```

逻辑不变，因为现有的推断已经足够。但新增 `getUserTier` 辅助函数：

**6b. 新增 `getUserTier` 函数**

```ts
type UserTier = 'user' | 'dev' | 'ops';

const getUserTier = (): UserTier => {
  if (!user.value) return 'user';
  if (user.value.is_superadmin) return 'ops';
  if (user.value.capabilities?.includes('admin_panel_access')) return 'ops';
  if (user.value.capabilities?.includes('dev_panel_access')) return 'dev';
  return 'user';
};
```

在 return 对象中导出 `getUserTier`。

---

### Step 7: 更新前端开发者后台

**7a. 更新 DevSidebar.vue — 根据能力动态显示菜单**

文件：`frontend/src/components/dev/DevSidebar.vue`

当前菜单项：
- 总览 (`dev_panel_access`)
- 组织管理 (`dev_panel_access`)
- 项目管理 (`dev_panel_access`)
- Bug 反馈 (`dev:bug_manage`)
- 评论管理 (`dev:comment_manage`)

新增菜单项：
- 项目成员 (`dev:project_admin`) — 管理项目成员
- 组织设置 (`dev:org_manage`) — 管理组织设置和成员

更新后菜单：
```ts
const allItems = [
  { key: 'dashboard', label: '总览', to: '/dev/dashboard', icon: LayoutDashboard, cap: 'dev_panel_access' },
  { key: 'organizations', label: '组织管理', to: '/dev/organizations', icon: Building2, cap: 'dev_panel_access' },
  { key: 'projects', label: '项目管理', to: '/dev/projects', icon: Package, cap: 'dev_panel_access' },
  { key: 'bugs', label: 'Bug 反馈', to: '/dev/bugs', icon: Bug, cap: 'dev:bug_manage' },
  { key: 'comments', label: '评论管理', to: '/dev/comments', icon: MessageSquare, cap: 'dev:comment_manage' },
];
```

注意：组织管理和项目管理的入口已经在侧边栏中，它们内部的操作按钮（如"添加成员"、"编辑组织"）需要根据 `dev:project_admin` 和 `dev:org_manage` 能力来控制显示。这需要在对应的页面组件中添加能力检查。

**7b. 更新 DevBottomNav.vue — 同步更新**

文件：`frontend/src/components/dev/DevBottomNav.vue`

与 DevSidebar 保持一致的菜单项和能力过滤。

**7c. 在开发者后台页面中添加能力校验**

需要在以下页面中添加能力校验（条件渲染操作按钮）：
- 项目详情页：添加/移除成员按钮需 `dev:project_admin`
- 组织详情页：编辑组织/添加移除成员按钮需 `dev:org_manage`

这些页面需要逐一检查和修改。由于这些页面可能较多，作为可选优化项，先确保侧边栏/底栏的菜单过滤正确。

---

### Step 8: 部署验证

**8a. 上传修改的文件到服务器**

需要上传的文件：
- `backend/migrations/0028_restructure_capability_categories.sql`
- `backend/src/services/capabilities.ts`
- `backend/src/services/rolePromotion.ts`
- `backend/src/services/capabilities.test.ts`
- `backend/src/plugins/casdoorAuth.ts`
- `backend/src/index.ts`
- `frontend/src/components/admin/CapabilityEditor.vue`
- `frontend/src/composables/useAuth.ts`
- `frontend/src/components/dev/DevSidebar.vue`
- `frontend/src/components/dev/DevBottomNav.vue`

**8b. 执行数据库迁移 0028**

在服务器上通过 Docker 容器或直接连接 PostgreSQL 执行迁移。

**8c. 重建 Docker 后端镜像**

```bash
docker compose build backend
docker compose up -d backend
```

**8d. 构建前端并部署**

```bash
cd frontend && npm run build
# 将 dist 目录部署到 Nginx
```

**8e. 验证**

- 检查后端健康状态：`/api/health`
- 检查能力列表：`/api/capabilities`（应返回41项能力，两级分类）
- 检查角色模板：`/api/admin/role-templates`（应包含8个模板）
- 测试新用户注册后是否自动获得默认权限
- 测试运维后台 CapabilityEditor 的三级折叠展示
- 测试开发者后台菜单根据能力动态显示

---

## 文件修改清单

| 文件 | 修改类型 | Step |
|------|----------|------|
| `backend/src/services/rolePromotion.ts` | 替换 `dev:member_manage` → `dev:project_admin` + `dev:org_manage` | 3a |
| `backend/src/services/capabilities.test.ts` | 更新测试用例 | 3b |
| `backend/src/plugins/casdoorAuth.ts` | 新用户创建后调用 `grantDefaultUserCapabilities` | 4a |
| `backend/src/index.ts` | 管理员创建用户后调用 `grantDefaultUserCapabilities` | 4b |
| `frontend/src/components/admin/CapabilityEditor.vue` | 三级折叠+中文标签+视觉区分 | 5 |
| `frontend/src/composables/useAuth.ts` | 新增 `getUserTier` | 6 |
| `frontend/src/components/dev/DevSidebar.vue` | 菜单能力过滤更新 | 7a |
| `frontend/src/components/dev/DevBottomNav.vue` | 菜单能力过滤更新 | 7b |

## 风险与注意事项

1. **迁移 0028 是破坏性的**：会删除 `dev:member_manage` 能力，已有用户的授权会迁移到新能力。确保迁移前备份数据库。
2. **前端构建依赖后端 API**：CapabilityEditor 的模板数据来自 `/api/admin/role-templates`，需确保后端先部署。
3. **测试覆盖**：`capabilities.test.ts` 修改后需确保所有测试通过。
4. **现有用户权限**：迁移 0028 会自动将 `dev:member_manage` 的用户授权迁移到 `dev:project_admin` + `dev:org_manage`，但 `rolePromotion.ts` 中的 `promoteToDev` 也需要同步更新，否则新晋升的开发者不会获得新能力。
