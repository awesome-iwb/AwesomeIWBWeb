# 运维管理后台 - 组织审批选中后详情变空白问题

## 问题描述

在运维管理后台（`AdminOrganizationsView.vue`）中，当用户从组织列表中选择一个"审核中"（pending）状态的组织时：
1. 该组织在列表中被高亮选中
2. 详情区域短暂显示组织信息
3. 然后详情区域变为一片空白（显示"从列表中选择组织查看详情"或完全空白）

## 问题分析与根因

### 1. `selectOrg` 函数分析

核心函数 `selectOrg`（位于 `AdminOrganizationsView.vue:212`）：

```typescript
const selectOrg = async (org: any) => {
  selectedOrgId.value = org.id;
  selectedOrg.value = org;
  reviewNote.value = '';
  inviteUserId.value = null;
  try {
    const res = await adminFetch(`/api/admin/organizations/${encodeURIComponent(org.id)}`);
    if (res.ok) {
      const detail = await res.json();
      selectedOrg.value = detail;
      orgMembers.value = detail.members ?? [];
      editOrgName.value = detail.name ?? '';
    }
  } catch {}
};
```

**问题路径：** 当 `selectOrg` 被调用时，它首先使用列表项数据设置 `selectedOrg`（确保立刻显示内容），然后发送异步 API 请求获取详情。

### 2. 根因定位：`fetchOrgs` 和 `selectOrg` 之间的竞态条件

关键问题在于 `fetchOrgs` 函数（位于 `AdminOrganizationsView.vue:172`）的行为：

```typescript
const fetchOrgs = async () => {
  try {
    // ... 获取组织列表 ...
    orgsPage.value = nextPage;

    const hasSelected = !!selectedOrgId.value;
    const selectedStillExists = hasSelected
      && nextPage.items.some((item: any) => item.id === selectedOrgId.value);

    if (hasSelected && !selectedStillExists) {
      selectedOrgId.value = null;
      selectedOrg.value = null;  // <-- 这会导致详情变空白！
      orgMembers.value = [];
      reviewNote.value = '';
      inviteUserId.value = null;
      editOrgName.value = '';
    }
  } catch {}
};
```

当 `fetchOrgs` 在 `selectOrg` **之后**完成时，它会检查 `selectedOrgId` 是否在新列表中存在。在特定条件下，这个检查可能意外失败：

1. **列表页面的数据可能不包含刚选中的组织** - 如果 `fetchOrgs` 中的 `orgsPage.value.page` 恰好与 `selectOrg` 时不同（例如，`fetchOrgs` 在 `onMounted` 中触发但尚未完成时用户点击了组织，然后 `fetchOrgs` 完成并更新了页面数据）

2. **更关键的问题：`statusFilter` 的 `v-model` 和 `@change` 双重调用 `fetchOrgs`** - 当用户选择筛选条件时，`statusFilter` 的 `watch` 和 `@change` 事件都会调用 `fetchOrgs`，导致两次网络请求。第一次请求可能返回的是旧分页的数据，导致选中的组织"不存在"而被清空。

3. **核心竞态条件**：
   - `onMounted` 调用 `fetchOrgs()` 发起异步请求
   - 用户快速点击组织 → `selectOrg(org)` 设置 `selectedOrgId` 和 `selectedOrg`
   - 之前 `onMounted` 中的 `fetchOrgs()` 完成 → 覆盖 `orgsPage.value`
   - 由于 `nextPage.items` 来自另一个分页/筛选条件，`selectedStillExists` 可能为 `false`
   - 结果：`selectedOrgId` 和 `selectedOrg` 被清空为 `null`，详情变空白！

### 3. 与"审核中"状态的特殊相关性

"审核中"状态与其他状态相比没有特别的 API 区别。但问题之所以更容易在审核中的组织上出现，可能是因为：
- 默认筛选器显示全部状态，审核中的组织通常数量较少，用户更容易先选中它们
- 当列表数据重新获取时（分页变化），审核中的组织可能刚好不在返回的页面中

## 受影响文件

### 前端文件

| 文件 | 修改类型 | 说明 |
|---|---|---|
| `d:\github\AwesomeIWBWeb\frontend\src\views\admin\AdminOrganizationsView.vue` | 修改 | 修复 `selectOrg` 和 `fetchOrgs` 间的竞态条件 |

### 后端文件

后端 API 逻辑正常，无需修改。

## 修复方案

### 方案概述

核心思路：**分离选择状态和数据状态**。

当前设计中，`selectedOrgId` 既是"是否选中"的状态标志，又是"要获取详情"的目标ID。当 `fetchOrgs` 在 `selectOrg` 之后完成时，它可能会错误地清空选择状态。

#### 修改 1：在 `selectOrg` 中添加防竞态标记

添加一个 `selectionTimestamp` 计数器或版本标记，确保 `fetchOrgs` 不会在 `selectOrg` 之后清空选择：

```typescript
let selectionVersion = 0; // 模块级变量

const selectOrg = async (org: any) => {
  const currentVersion = ++selectionVersion;
  selectedOrgId.value = org.id;
  selectedOrg.value = org;
  // ...
  try {
    const res = await adminFetch(`/api/admin/organizations/${encodeURIComponent(org.id)}`);
    if (res.ok && selectionVersion === currentVersion) { // 检查版本
      const detail = await res.json();
      selectedOrg.value = detail;
      // ...
    }
  } catch {}
};
```

这样即使 `selectOrg` 被多次调用，只有最后一次的响应会生效。

#### 修改 2：`fetchOrgs` 不自动清空选择

修改 `fetchOrgs` 中的清空逻辑，使其只在用户执行明确的"取消选择"操作时才清空，而不是在列表刷新时自动清空：

```typescript
// fetchOrgs 中移除自动清空 selectedOrg 的逻辑
// 或者在清空前检查 selectedOrgId 是否仍然指向有效的组织
```

但更安全的做法是保留这个逻辑（因为如果选中的组织确实被删除了，应该清空），但添加版本检查防止误清空。

#### 修改 3：修复 `statusFilter` 的 `watch` 和 `@change` 双重调用

```html
<!-- 当前：v-model 和 @change 都会触发 fetchOrgs -->
<select v-model="statusFilter" @change="fetchOrgs" ...>
```

应该只保留 `watch` 中的调用，移除 `@change="fetchOrgs"`：

```html
<select v-model="statusFilter" ...>
```

同时修改 `watch(statusFilter)` 使其使用防抖或者在调用 `fetchOrgs` 前清理之前的请求。

### 详细实现

```typescript
// 添加版本计数器
let fetchVersion = 0;

const selectOrg = async (org: any) => {
  const currentVersion = ++fetchVersion;
  selectedOrgId.value = org.id;
  selectedOrg.value = org;
  reviewNote.value = '';
  inviteUserId.value = null;
  try {
    const res = await adminFetch(`/api/admin/organizations/${encodeURIComponent(org.id)}`);
    // 版本检查：确保这是最新的选择操作的结果
    if (res.ok && fetchVersion === currentVersion) {
      const detail = await res.json();
      selectedOrg.value = detail;
      orgMembers.value = detail.members ?? [];
      editOrgName.value = detail.name ?? '';
    }
  } catch {}
};

const fetchOrgs = async () => {
  const currentVersion = ++fetchVersion;
  try {
    const qs = new URLSearchParams();
    if (statusFilter.value) qs.set('status', statusFilter.value);
    qs.set('page', String(orgsPage.value.page));
    qs.set('pageSize', String(orgsPage.value.pageSize));
    const res = await adminFetch(`/api/admin/organizations?${qs.toString()}`);
    if (!res.ok) return;
    const nextPage = await res.json();
    // 版本检查：避免旧请求覆盖新状态
    if (fetchVersion !== currentVersion) return;
    orgsPage.value = nextPage;

    const hasSelected = !!selectedOrgId.value;
    const selectedStillExists = hasSelected
      && nextPage.items.some((item: any) => item.id === selectedOrgId.value);

    if (hasSelected && !selectedStillExists) {
      selectedOrgId.value = null;
      selectedOrg.value = null;
      orgMembers.value = [];
      reviewNote.value = '';
      inviteUserId.value = null;
      editOrgName.value = '';
    }
  } catch {}
};
```

同时修复模板中的双重调用：
```html
<!-- 修改前 -->
<select v-model="statusFilter" @change="fetchOrgs" ...>

<!-- 修改后 -->
<select v-model="statusFilter" ...>
```

并确保 `watch(statusFilter)` 中的 `fetchOrgs` 调用使用 `void` 或 `await`：

```typescript
watch(statusFilter, () => {
  orgsPage.value.page = 1;
  selectedOrgId.value = null;
  selectedOrg.value = null;
  orgMembers.value = [];
  reviewNote.value = '';
  inviteUserId.value = null;
  editOrgName.value = '';
  fetchOrgs(); // 已经用了 void，但移除 @change 后不会双重触发
});
```

## 边界条件

1. **快速连续点击不同组织**：版本计数器确保只有最后一次点击的详情会显示
2. **详情 API 失败**：保持列表项数据，不覆盖为 null
3. **列表刷新时组织被删除**：`fetchOrgs` 中的清空逻辑保留，但通过版本检查防止误清空
4. **切换筛选器**：`watch(statusFilter)` 正常清空选择，这是用户意图

## 预期结果

修复后，用户点击任何一个组织（包括审核中的），详情区域会：
1. 立即显示列表项中的基本信息（现有行为保持不变）
2. 等待详情 API 完成，更新为完整的详细信息
3. 不会意外变为空白

## 数据流

```
用户点击组织
  → selectOrg(org) 被调用
    → 设置 selectedOrgId = org.id, selectedOrg = org（从列表项）
    → 递增 fetchVersion
    → 开始异步获取详情
    → fetchOrgs 可能同时被调用（但带了版本检查）
  → 详情 API 返回
    → 检查 fetchVersion 是否匹配（防止竞态）
    → 如果匹配：更新 selectedOrg 为完整详情
    → 如果不匹配：丢弃旧响应
```