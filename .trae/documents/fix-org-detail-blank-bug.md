# 修复组织详情页"选中后自动变为空白"Bug — 实施计划

## 一、Bug 现象分析

**用户报告**：在开发者后台的组织管理页面，用户点击一个「审核中」(pending) 的组织，进入组织详情页后，页面会短暂显示组织信息，然后自动变为空白/空组织状态，导致无法审核未通过审核的组织。此问题在移动端和桌面端都存在。

### 症状特征

- 点击组织 → 短暂显示详情 → 自动变为空白
- 特别影响状态为 `pending`（审核中）的组织
- 移动端和桌面端都复现

---

## 二、代码流程追踪

### 路由结构
```
/dev (DevLayout → AdminShell → <router-view>)
  ├── /dev/organizations       → DevOrganizationsView (列表页)
  ├── /dev/organizations/create → DevOrgCreateView
  └── /dev/organizations/:id   → DevOrgDetailView (详情页) ⚠️ 问题页面
```

### DevOrgDetailView 关键逻辑
1. `orgId = route.params.id as string` — 仅在 setup 时读取一次
2. `onMounted(fetchOrg)` — 仅挂载时调用一次
3. `fetchOrg` 调用 `adminFetch(API.dev.organizationDetail(orgId))`
4. 成功时设置 `org.value = json`
5. **无 `watch` 监听 `route.params.id` 的变化**

### 关键发现：缺少 `watch` on `route.params.id`

[DevOrgDetailView.vue](file:///d:/github/AwesomeIWBWeb/frontend/src/views/dev/DevOrgDetailView.vue) 第 144、285 行：
```typescript
const orgId = route.params.id as string;  // 仅在 setup 时读取
// ...
onMounted(fetchOrg);  // 仅在挂载时调用
```

## 三、根本原因分析（根因假设）

### 假设 1（最可能）：`orgId` 在组件初始化时为 `undefined`，导致 API 调用失败

1. 用户点击组织卡片 → 路由变化 → `DevOrgDetailView` 组件挂载
2. 在组件 `setup()` 阶段，`route.params.id` 可能尚未完全解析（Vue Router 的异步特性）
3. `orgId` 被赋值为 `undefined`（或一个过渡状态的值）
4. `onMounted` 调用 `fetchOrg`，请求 URL 为 `/api/dev/organizations/undefined`
5. 后端返回失败或空数据
6. `org` 保持为 `null`，页面显示"组织不存在或无权访问"

**验证方式**：检查 `fetchOrg` 的 catch 分支中是否有错误信息被静默吞掉（`console.error`），同时 `if (res.ok)` 为 false 时也不设置 `org`。

看代码：
```typescript
const fetchOrg = async () => {
  loading.value = true;
  try {
    const res = await adminFetch(API.dev.organizationDetail(orgId));
    if (res.ok) {
      const json = await res.json();
      org.value = json;
      // ...
    }
    // ⚠️ 如果 res.ok 为 false，org 保持 null，静默失败
  } catch (e) {
    console.error('Fetch dev org detail error:', e);
    // ⚠️ 异常被捕获但不给用户提示
  } finally {
    loading.value = false;
  }
};
```

### 假设 2：缺少 `watch` 导致用户在不同组织间切换时数据不同步

虽然这不是用户报告的当前问题（用户只点击了一个组织），但这确实是一个潜在的 bug：如果用户从组织 A 的详情页直接导航到组织 B 的详情页，组件不会重新挂载（因为是同路由），`onMounted` 不会触发，因此 `fetchOrg` 不会被再次调用，页面会继续显示组织 A 的数据。

---

## 四、修复方案

### 步骤 1：在 `DevOrgDetailView.vue` 中添加 `watch` 监听 `route.params.id`

**修改文件**：[DevOrgDetailView.vue](file:///d:/github/AwesomeIWBWeb/frontend/src/views/dev/DevOrgDetailView.vue)

在 `onMounted(fetchOrg)` 之后添加：

```typescript
import { watch } from 'vue';

watch(
  () => route.params.id,
  (newId) => {
    if (newId && newId !== orgId) {
      orgId = newId as string;
      fetchOrg();
    }
  }
);
```

### 步骤 2：添加 `orgId` 为空时的防御性检查

在 `fetchOrg` 函数开头添加验证：

```typescript
const fetchOrg = async () => {
  if (!orgId) {
    loading.value = false;
    return;
  }
  loading.value = true;
  // ... 原有逻辑
};
```

### 步骤 3：添加获取失败时的用户可见状态

当 `res.ok` 为 `false` 时，不应静默失败。需要区分「加载中」「加载失败」「数据为空」三种状态：

- 新增 `error` ref，当 API 请求失败时设置
- 模板中添加错误状态的展示（可使用已有的 `ErrorState` 组件）

### 步骤 4：模板中添加错误状态显示

在"组织不存在"之上增加错误状态判断：

```html
<ui-ErrorState
  v-else-if="error"
  title="加载组织信息失败"
  :description="error"
  @retry="fetchOrg"
/>
<div v-else class="text-center py-20 text-slate-400">
  <p class="text-sm">组织不存在或无权访问</p>
</div>
```

---

## 五、实施步骤

| 步骤 | 文件 | 内容 |
|------|------|------|
| 1 | `DevOrgDetailView.vue` | 引入 `watch`，添加路由参数变化监听 |
| 2 | `DevOrgDetailView.vue` | 在 `fetchOrg` 开头添加 `orgId` 空值检查 |
| 3 | `DevOrgDetailView.vue` | 新增 `error` ref，API 失败时设置错误信息 |
| 4 | `DevOrgDetailView.vue` | 模板中添加 `ErrorState` 组件处理失败状态 |
| 5 | 构建验证 | 运行 `npm run build` 确认无编译错误 |

---

## 六、验证方式

1. **正常组织**：点击一个正常状态的组织，应正常显示详情
2. **审核中组织**：点击一个 `pending` 状态的组织，应正常显示详情（不再消失）
3. **无效 ID**：手动输入 `/dev/organizations/nonexistent`，应显示"组织不存在或无权访问"
4. **组织间切换**：从组织 A 详情页通过路由跳到组织 B，应正确刷新数据