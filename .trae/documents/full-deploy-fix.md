# 全量部署修复计划

## 问题清单

### 问题 1：路由管理页面不显示（侧栏 + 底部导航）
- **根因**：`capabilities.ts` 的 `ALL_CAPABILITIES` 数组中缺少 `route:manage`
- **影响**：`userHasCapability()` 第 95 行检查 `ALL_CAPABILITY_IDS.has(capabilityId)`，不在列表中的权限直接返回 false
- **修复**：在 `ALL_CAPABILITIES` 数组中添加 `analytics:read` 和 `route:manage`

### 问题 2：数据分析页面点不开（500 错误）
- **根因**：同问题 1，`analytics:read` 也不在 `ALL_CAPABILITIES` 数组中
- **影响**：`checkCapAny` 调用 `userHasCapability`，因 `analytics:read` 不在白名单而返回 false，导致 403/500
- **修复**：同上

### 问题 3：手机版没有用户管理功能
- **根因**：`AdminLayout.vue` 中 users 导航项设为 `group: 'primary'`，但 `AdminShell.vue` 的 `primaryItems` 只取 `group === 'primary'` 的前 4 项（slice(0, 4)），dashboard/stories/projects/review 已占满 4 位，users 被截断丢弃。同时 users 不在 `secondary` 组中，所以也不会出现在"更多"抽屉
- **修复**：将 users 的 `group` 改为 `'secondary'`，使其出现在"更多"抽屉中

### 问题 4：前端侧栏不根据权限过滤（已修复但需确认部署）
- **状态**：上一次已修复 `AdminLayout.vue` 和 `DevLayout.vue` 添加了 `visibleNavItems` 过滤
- **需确认**：最新代码是否已正确部署到服务器

## 修复步骤

### Step 1：修复后端 `capabilities.ts` — 添加缺失的权限定义
- 文件：`backend/src/services/capabilities.ts`
- 在 `ALL_CAPABILITIES` 数组中添加：
  - `{ id: 'analytics:read', name: '查看数据分析', category: 'admin.analytics', description: '查看网站访问统计和用户行为分析', sort_index: 2500 }`
  - `route:manage` 已存在（第 58 行），确认无误

### Step 2：修复前端 `AdminLayout.vue` — 用户权限移至 secondary 组
- 文件：`frontend/src/views/admin/AdminLayout.vue`
- 将 users 导航项的 `group` 从 `'primary'` 改为 `'secondary'`

### Step 3：构建前端
- `cd frontend && npm run build`

### Step 4：全量部署
1. 上传全部后端 src 文件到 `/opt/awesomeiwb/backend/src/`
2. 重建 Docker 镜像：`docker compose build backend`
3. 重启容器：`docker compose up -d backend`
4. 上传前端 dist 到 `/var/www/awesomeiwb/dist/` 和 `/www/sites/aiwb.smart-teach.cn/dist/`

### Step 5：验证
1. 检查 Docker 容器状态
2. 测试 analytics API
3. 测试 pages API
4. 检查前端页面是否正确渲染
