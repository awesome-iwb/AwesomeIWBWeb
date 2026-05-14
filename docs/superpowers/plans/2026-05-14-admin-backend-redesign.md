# 管理后台重构 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将单体 AdminView.vue 重构为嵌套路由 + 侧边栏架构，按 Capability 控制模块可见性，新增总览看板、增强图床管理和用户权限管理。

**Architecture:** 前端使用 Vue Router 嵌套路由，`/admin` 下挂载 AdminLayout 壳组件，9 个子路由各对应独立视图组件。侧边栏/底部导航按用户 Capability 动态显隐。后端新增 dashboard API 和 media tags API，新增 `media_tags` 数据库表。

**Tech Stack:** Vue 3 + Vue Router + TypeScript (前端), Elysia + PostgreSQL (后端), Lucide Vue Next (图标), Tailwind CSS (样式)

---

## 文件结构

### 新建文件

| 文件 | 职责 |
|------|------|
| `frontend/src/views/admin/AdminLayout.vue` | 侧边栏 + 顶栏壳，含 `<router-view />` |
| `frontend/src/views/admin/DashboardView.vue` | 总览看板页 |
| `frontend/src/views/admin/StoriesView.vue` | 文章管理（从 AdminView 提取） |
| `frontend/src/views/admin/ProjectsView.vue` | 项目管理（从 AdminView 提取） |
| `frontend/src/views/admin/SubmissionsView.vue` | 项目审核（从 AdminView 提取） |
| `frontend/src/views/admin/ModerationView.vue` | 内容审核（从 AdminView 提取） |
| `frontend/src/views/admin/FeedbackView.vue` | 评论反馈（包装 CommentPanel） |
| `frontend/src/views/admin/UsersView.vue` | 用户权限管理（增强版） |
| `frontend/src/views/admin/MediaView.vue` | 图床管理（增强版） |
| `frontend/src/views/admin/AuditView.vue` | 审计日志（从弹窗提升为页面） |
| `frontend/src/components/admin/AdminSidebar.vue` | 桌面端侧边栏导航 |
| `frontend/src/components/admin/AdminBottomNav.vue` | 移动端底部导航 |
| `frontend/src/components/admin/DashboardCard.vue` | 看板指标卡片 |
| `frontend/src/components/admin/CapabilityEditor.vue` | 折叠式能力编辑器 |
| `frontend/src/components/admin/MediaTagInput.vue` | 标签输入 Chip 组件 |
| `frontend/src/components/admin/MediaBatchActions.vue` | 批量操作工具栏 |
| `frontend/src/composables/useAdminFetch.ts` | 后台 API 请求封装（提取自 AdminView） |
| `backend/migrations/0019_media_tags.sql` | media_tags 表迁移 |
| `backend/src/services/dashboard.ts` | 看板数据服务 |

### 修改文件

| 文件 | 修改内容 |
|------|---------|
| `frontend/src/router/index.ts` | `/admin` 改为嵌套路由，添加子路由 |
| `frontend/src/api/endpoints.ts` | 新增 dashboard、media tags API 端点 |
| `backend/src/services/capabilities.ts` | 新增 ROLE_TEMPLATES 常量 |
| `backend/src/services/media.ts` | 新增标签 CRUD、批量操作函数 |
| `backend/src/index.ts` | 新增 dashboard、media tags 路由 |

### 删除文件

| 文件 | 原因 |
|------|------|
| `frontend/src/views/AdminView.vue` | 被拆分为 admin/ 下的多个独立视图 |

---

## Task 1: 创建 useAdminFetch composable

**Files:**
- Create: `frontend/src/composables/useAdminFetch.ts`

从 AdminView.vue 中提取 `adminFetch`、`formatAdminError`、`normalizeMediaUrl`、`isInternalUploadUrl` 等通用函数为独立 composable，供所有 admin 子视图共享。

- [ ] **Step 1: 创建 useAdminFetch.ts**

```typescript
import { ref } from 'vue';
import { useAuth } from './useAuth';

export function useAdminFetch() {
  const { user, token } = useAuth();

  const adminFetch = async (url: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    const authToken = token.value || '';
    if (authToken) {
      headers.set('Authorization', `Bearer ${authToken}`);
    }
    const method = (options.method ?? 'GET').toUpperCase();
    const requestOptions: RequestInit = { ...options, headers, credentials: 'include' };
    if (method === 'GET' && requestOptions.cache === undefined) {
      requestOptions.cache = 'no-cache';
    }
    return fetch(url, requestOptions);
  };

  const formatAdminError = (payload: any, fallback: string, status?: number): string => {
    const nested = payload?.error;
    if (nested && typeof nested === 'object') {
      const msg = String(nested.message ?? fallback);
      const codePart = nested.code ? ` [${String(nested.code)}]` : '';
      const tracePart = nested.traceId ? ` (trace: ${String(nested.traceId)})` : '';
      return `${msg}${codePart}${tracePart}`;
    }
    if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message.trim();
    if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error.trim();
    if (typeof status === 'number') return `${fallback} (${status})`;
    return fallback;
  };

  const isInternalUploadUrl = (value: string) => value.startsWith('/api/uploads/');

  const normalizeMediaUrl = (value: unknown): string => {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (isInternalUploadUrl(trimmed)) return trimmed;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    return trimmed;
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await adminFetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(formatAdminError(json, '上传失败', res.status));
      }
      const json = await res.json();
      return json.url ?? null;
    } catch (e: any) {
      throw e;
    }
  };

  const formatBytes = (size: unknown): string => {
    const n = Number(size);
    if (!Number.isFinite(n) || n < 0) return '—';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
    return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatDateTime = (value: unknown): string => {
    if (!value || typeof value !== 'string') return '—';
    try {
      return new Date(value).toLocaleString('zh-CN');
    } catch {
      return String(value);
    }
  };

  return {
    adminFetch,
    formatAdminError,
    isInternalUploadUrl,
    normalizeMediaUrl,
    uploadFile,
    formatBytes,
    formatDateTime,
  };
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd frontend && npx vue-tsc --noEmit 2>&1 | head -20`
Expected: 无 useAdminFetch 相关错误

- [ ] **Step 3: 提交**

```bash
git add frontend/src/composables/useAdminFetch.ts
git commit -m "feat(admin): 提取 useAdminFetch composable"
```

---

## Task 2: 后端 — 新增角色模板常量和 dashboard API

**Files:**
- Modify: `backend/src/services/capabilities.ts`
- Create: `backend/src/services/dashboard.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: 在 capabilities.ts 中新增 ROLE_TEMPLATES**

在 `capabilities.ts` 文件末尾（`getUserCapabilitiesWithInfo` 函数之后）添加：

```typescript
export type RoleTemplate = {
  name: string;
  capabilityIds: string[];
};

export const ROLE_TEMPLATES: Record<string, RoleTemplate> = {
  superadmin: {
    name: "超级管理员",
    capabilityIds: getAllCapabilityIds(),
  },
  reviewer: {
    name: "审核员",
    capabilityIds: [
      "admin_panel_access",
      "submission:read",
      "submission:approve",
      "submission:reject",
      "moderation:read",
      "moderation:approve",
      "moderation:reject",
      "feedback:manage",
      "comment:manage",
    ],
  },
  editor: {
    name: "编辑",
    capabilityIds: [
      "admin_panel_access",
      "story:manage",
      "project:read",
      "project:create",
      "project:update",
      "category:manage",
      "media:read",
      "media:manage",
    ],
  },
  developer: {
    name: "开发者",
    capabilityIds: [
      "dev_panel_access",
      "project:read",
      "submission:read",
    ],
  },
};

export function getRoleTemplates(): Record<string, RoleTemplate> {
  return ROLE_TEMPLATES;
}
```

- [ ] **Step 2: 创建 dashboard.ts 服务**

```typescript
import { sql } from "../db/client";
import { userHasCapability, isSuperadmin } from "./capabilities";

const dbEnabled = Boolean(process.env.DATABASE_URL);

export type DashboardData = {
  projects?: { total: number; newThisWeek: number };
  pendingSubmissions?: number;
  pendingModeration?: { comments: number; bugs: number };
  openFeedback?: number;
  users?: { total: number; newThisWeek: number };
  media?: { total: number; totalSize: number };
  stories?: number;
  recentActivity?: Array<{ action: string; entity_type: string; entity_id: string; actor: string; created_at: string }>;
};

export async function getDashboardData(userId: string, username: string): Promise<DashboardData> {
  if (!dbEnabled) return {};

  const data: DashboardData = {};
  const isSuper = isSuperadmin(username);

  async function hasCap(capId: string): Promise<boolean> {
    if (isSuper) return true;
    return userHasCapability(userId, username, capId);
  }

  if (await hasCap("project:read")) {
    const [{ total }] = await sql()<Array<{ total: string }>>`select count(*)::text as total from projects`;
    const [{ new_this_week }] = await sql()<Array<{ new_this_week: string }>>`select count(*)::text as new_this_week from projects where created_at >= now() - interval '7 days'`;
    data.projects = { total: Number(total), newThisWeek: Number(new_this_week) };
  }

  if (await hasCap("submission:read")) {
    const [{ count }] = await sql()<Array<{ count: string }>>`select count(*)::text as count from submissions where status = 'pending'`;
    data.pendingSubmissions = Number(count);
  }

  if (await hasCap("moderation:read")) {
    const [{ comments }] = await sql()<Array<{ comments: string }>>`select count(*)::text as comments from feedback where kind = 'comment' and status = 'pending'`;
    const [{ bugs }] = await sql()<Array<{ bugs: string }>>`select count(*)::text as bugs from feedback where kind = 'bug' and status = 'pending'`;
    data.pendingModeration = { comments: Number(comments), bugs: Number(bugs) };
  }

  if (await hasCap("feedback:manage")) {
    const [{ count }] = await sql()<Array<{ count: string }>>`select count(*)::text as count from feedback where status = 'open'`;
    data.openFeedback = Number(count);
  }

  if (await hasCap("user:read")) {
    const [{ total }] = await sql()<Array<{ total: string }>>`select count(*)::text as total from users`;
    const [{ new_this_week }] = await sql()<Array<{ new_this_week: string }>>`select count(*)::text as new_this_week from users where created_at >= now() - interval '7 days'`;
    data.users = { total: Number(total), newThisWeek: Number(new_this_week) };
  }

  if (await hasCap("media:read")) {
    const [{ total }] = await sql()<Array<{ total: string }>>`select count(*)::text as total from media_assets where status = 'active'`;
    const [{ total_size }] = await sql()<Array<{ total_size: string }>>`select coalesce(sum(size), 0)::text as total_size from media_assets where status = 'active'`;
    data.media = { total: Number(total), totalSize: Number(total_size) };
  }

  if (await hasCap("story:manage")) {
    const [{ count }] = await sql()<Array<{ count: string }>>`select count(*)::text as count from stories`;
    data.stories = Number(count);
  }

  if (await hasCap("audit:read")) {
    const rows = await sql()<Array<{ action: string; entity_type: string; entity_id: string; actor: string; created_at: string }>>`
      select action, entity_type, entity_id, actor, created_at
      from audit_logs
      order by created_at desc
      limit 10
    `;
    data.recentActivity = rows;
  }

  return data;
}
```

- [ ] **Step 3: 在 index.ts 中添加 dashboard 和 role-templates 路由**

在 `backend/src/index.ts` 中，找到 admin API 路由区域，添加以下路由（在其他 `/api/admin/*` 路由附近）：

```typescript
import { getDashboardData } from "./services/dashboard";
import { getRoleTemplates } from "./services/capabilities";
```

然后在 admin 路由组中添加：

```typescript
.get("/api/admin/dashboard", async ({ user, set }) => {
  const capErr = await checkCap(user, set, "admin_panel_access");
  if (capErr) return capErr;
  const data = await getDashboardData(String(user!.id), user!.name);
  return data;
})
.get("/api/admin/role-templates", async ({ user, set }) => {
  const capErr = await checkCap(user, set, "user:manage");
  if (capErr) return capErr;
  return getRoleTemplates();
})
```

- [ ] **Step 4: 验证后端编译**

Run: `cd backend && npx tsc --noEmit 2>&1 | head -20`
Expected: 无错误

- [ ] **Step 5: 提交**

```bash
git add backend/src/services/capabilities.ts backend/src/services/dashboard.ts backend/src/index.ts
git commit -m "feat(admin): 新增角色模板常量和 dashboard API"
```

---

## Task 3: 后端 — 新增 media_tags 表和 API

**Files:**
- Create: `backend/migrations/0019_media_tags.sql`
- Modify: `backend/src/services/media.ts`
- Modify: `backend/src/index.ts`
- Modify: `backend/src/apiRegistry.ts`

- [ ] **Step 1: 创建迁移文件 0019_media_tags.sql**

```sql
-- Migration: media tags
-- Date: 2026-05-14

CREATE TABLE IF NOT EXISTS media_tags (
  media_id UUID NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (media_id, tag)
);

CREATE INDEX IF NOT EXISTS media_tags_tag_idx ON media_tags(tag);
```

- [ ] **Step 2: 在 media.ts 中新增标签和批量操作函数**

在 `media.ts` 文件末尾添加：

```typescript
export async function getMediaTags(mediaId: string): Promise<string[]> {
  if (!dbEnabled) return [];
  const rows = await sql()<Array<{ tag: string }>>`
    select tag from media_tags where media_id = ${mediaId} order by tag
  `;
  return rows.map(r => r.tag);
}

export async function setMediaTags(mediaId: string, tags: string[]): Promise<string[]> {
  if (!dbEnabled) return [];
  await sql()`delete from media_tags where media_id = ${mediaId}`;
  if (tags.length === 0) return [];
  const values = tags.map(t => `('${mediaId}', '${t.replace(/'/g, "''")}')`).join(", ");
  await sql().unsafe(`insert into media_tags (media_id, tag) values ${values} on conflict do nothing`);
  return tags;
}

export async function batchTagMedia(mediaIds: string[], tagsToAdd: string[], tagsToRemove: string[]): Promise<void> {
  if (!dbEnabled) return;
  for (const mid of mediaIds) {
    for (const tag of tagsToRemove) {
      await sql()`delete from media_tags where media_id = ${mid} and tag = ${tag}`;
    }
    for (const tag of tagsToAdd) {
      await sql()`insert into media_tags (media_id, tag) values (${mid}, ${tag}) on conflict do nothing`;
    }
  }
}

export async function batchSoftDeleteMedia(mediaIds: string[]): Promise<number> {
  if (!dbEnabled) return 0;
  const result = await sql().unsafe(
    `update media_assets set status = 'deleted', deleted_at = coalesce(deleted_at, now()) where id = ANY($1) and status = 'active'`,
    [mediaIds]
  );
  return (result as any).rowCount ?? 0;
}
```

同时修改 `listMediaAssets` 函数，在 filters 参数中新增 `tag?: string`，在 where 条件构建中添加：

```typescript
if (filters.tag) {
  whereParts.push(db`id in (select media_id from media_tags where tag = ${filters.tag})`);
}
```

- [ ] **Step 3: 在 index.ts 中添加 media tags 和批量操作路由**

在 admin 路由组中添加：

```typescript
.patch("/api/admin/media/:id/tags", async ({ user, set, params, body }) => {
  const capErr = await checkCap(user, set, "media:manage");
  if (capErr) return capErr;
  const tags = await setMediaTags(String(params.id), body.tags as string[]);
  return { tags };
}, {
  body: t.Object({ tags: t.Array(t.String()) })
})
.get("/api/admin/media/:id/tags", async ({ user, set, params }) => {
  const capErr = await checkCap(user, set, "media:read");
  if (capErr) return capErr;
  const tags = await getMediaTags(String(params.id));
  return { tags };
})
.post("/api/admin/media/batch-tag", async ({ user, set, body }) => {
  const capErr = await checkCap(user, set, "media:manage");
  if (capErr) return capErr;
  await batchTagMedia(body.mediaIds as string[], body.tagsToAdd as string[], body.tagsToRemove as string[]);
  return { success: true };
}, {
  body: t.Object({
    mediaIds: t.Array(t.String()),
    tagsToAdd: t.Array(t.String()),
    tagsToRemove: t.Array(t.String()),
  })
})
.post("/api/admin/media/batch-delete", async ({ user, set, body }) => {
  const capErr = await checkCap(user, set, "media:manage");
  if (capErr) return capErr;
  const count = await batchSoftDeleteMedia(body.mediaIds as string[]);
  return { deleted: count };
}, {
  body: t.Object({ mediaIds: t.Array(t.String()) })
})
```

- [ ] **Step 4: 更新 apiRegistry.ts**

在 `API_REGISTRY` 数组中添加：

```typescript
{ id: 'admin.media.tags.get', method: 'GET', path: '/api/admin/media/:id/tags', scope: 'admin' },
{ id: 'admin.media.tags.patch', method: 'PATCH', path: '/api/admin/media/:id/tags', scope: 'admin' },
{ id: 'admin.media.batchTag', method: 'POST', path: '/api/admin/media/batch-tag', scope: 'admin' },
{ id: 'admin.media.batchDelete', method: 'POST', path: '/api/admin/media/batch-delete', scope: 'admin' },
{ id: 'admin.dashboard', method: 'GET', path: '/api/admin/dashboard', scope: 'admin' },
{ id: 'admin.roleTemplates', method: 'GET', path: '/api/admin/role-templates', scope: 'admin' },
```

- [ ] **Step 5: 验证后端编译**

Run: `cd backend && npx tsc --noEmit 2>&1 | head -20`
Expected: 无错误

- [ ] **Step 6: 提交**

```bash
git add backend/migrations/0019_media_tags.sql backend/src/services/media.ts backend/src/index.ts backend/src/apiRegistry.ts
git commit -m "feat(admin): 新增 media_tags 表、标签 API 和批量操作 API"
```

---

## Task 4: 前端 — 更新 API 端点和路由

**Files:**
- Modify: `frontend/src/api/endpoints.ts`
- Modify: `frontend/src/router/index.ts`

- [ ] **Step 1: 更新 endpoints.ts**

在 `admin` 对象中新增：

```typescript
admin: {
  categories: '/api/admin/categories',
  projects: '/api/admin/projects',
  submissions: '/api/admin/submissions',
  moderationComments: '/api/admin/moderation/comments',
  moderationBugs: '/api/admin/moderation/bugs',
  users: '/api/admin/users',
  auditLogs: '/api/admin/audit-logs',
  media: '/api/admin/media',
  dashboard: '/api/admin/dashboard',
  roleTemplates: '/api/admin/role-templates',
  mediaTags: (id: string) => `/api/admin/media/${encodeURIComponent(id)}/tags`,
  mediaBatchTag: '/api/admin/media/batch-tag',
  mediaBatchDelete: '/api/admin/media/batch-delete',
},
```

- [ ] **Step 2: 更新 router/index.ts**

将 `/admin` 路由改为嵌套路由结构。替换原来的 admin 路由定义：

```typescript
import AdminLayout from '../views/admin/AdminLayout.vue'

// 在 routes 数组中替换原来的 admin 路由：
{
  path: '/admin',
  component: AdminLayout,
  meta: { requiresAuth: true, requiresCapability: 'admin_panel_access' },
  children: [
    { path: '', redirect: '/admin/dashboard' },
    { path: 'dashboard', name: 'admin-dashboard', component: () => import('../views/admin/DashboardView.vue'), meta: { title: '总览' } },
    { path: 'stories', name: 'admin-stories', component: () => import('../views/admin/StoriesView.vue'), meta: { title: '文章管理', requiresCapability: 'story:manage' } },
    { path: 'projects', name: 'admin-projects', component: () => import('../views/admin/ProjectsView.vue'), meta: { title: '项目管理', requiresCapability: 'project:read' } },
    { path: 'submissions', name: 'admin-submissions', component: () => import('../views/admin/SubmissionsView.vue'), meta: { title: '项目审核', requiresCapability: 'submission:read' } },
    { path: 'moderation', name: 'admin-moderation', component: () => import('../views/admin/ModerationView.vue'), meta: { title: '内容审核', requiresCapability: 'moderation:read' } },
    { path: 'feedback', name: 'admin-feedback', component: () => import('../views/admin/FeedbackView.vue'), meta: { title: '评论反馈', requiresCapability: 'feedback:manage' } },
    { path: 'users', name: 'admin-users', component: () => import('../views/admin/UsersView.vue'), meta: { title: '用户权限', requiresCapability: 'user:read' } },
    { path: 'media', name: 'admin-media', component: () => import('../views/admin/MediaView.vue'), meta: { title: '图床管理', requiresCapability: 'media:read' } },
    { path: 'audit', name: 'admin-audit', component: () => import('../views/admin/AuditView.vue'), meta: { title: '审计日志', requiresCapability: 'audit:read' } },
  ],
},
```

同时更新 `setupRouterGuard` 中的 `requiresCapability` 检查逻辑，使其也支持嵌套路由的 meta 继承。

- [ ] **Step 3: 验证前端编译**

Run: `cd frontend && npx vue-tsc --noEmit 2>&1 | head -20`
Expected: 无路由相关错误（AdminLayout 等组件尚未创建，会有 import 错误，这是预期的）

- [ ] **Step 4: 提交**

```bash
git add frontend/src/api/endpoints.ts frontend/src/router/index.ts
git commit -m "feat(admin): 更新 API 端点和嵌套路由配置"
```

---

## Task 5: 前端 — 创建 AdminLayout 和导航组件

**Files:**
- Create: `frontend/src/views/admin/AdminLayout.vue`
- Create: `frontend/src/components/admin/AdminSidebar.vue`
- Create: `frontend/src/components/admin/AdminBottomNav.vue`

- [ ] **Step 1: 创建 AdminSidebar.vue**

桌面端侧边栏，按 Capability 过滤导航项：

```vue
<template>
  <aside class="hidden lg:flex flex-col w-56 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 h-screen sticky top-0">
    <div class="p-4 border-b border-slate-100 dark:border-slate-700">
      <h1 class="text-lg font-extrabold">
        <span class="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-500">Awesome</span>
        <span class="text-slate-900 dark:text-white"> 后台</span>
      </h1>
    </div>
    <nav class="flex-1 overflow-y-auto p-3 space-y-1">
      <router-link
        v-for="item in visibleItems"
        :key="item.key"
        :to="item.to"
        class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
        :class="isActive(item.key) ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'"
      >
        <component :is="item.icon" class="w-5 h-5" />
        {{ item.label }}
      </router-link>
    </nav>
    <div class="p-3 border-t border-slate-100 dark:border-slate-700">
      <button @click="$emit('logout')" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors">
        <LogOut class="w-5 h-5" />
        退出
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuth } from '../../composables/useAuth';
import {
  LayoutDashboard, FileText, Package, ClipboardCheck,
  Shield, MessageSquare, Users, Image, ScrollText, LogOut,
} from 'lucide-vue-next';

defineEmits<{ logout: [] }>();

const route = useRoute();
const { hasCapability } = useAuth();

const allItems = [
  { key: 'dashboard', label: '总览', to: '/admin/dashboard', icon: LayoutDashboard, cap: 'admin_panel_access' },
  { key: 'stories', label: '文章管理', to: '/admin/stories', icon: FileText, cap: 'story:manage' },
  { key: 'projects', label: '项目管理', to: '/admin/projects', icon: Package, cap: 'project:read' },
  { key: 'submissions', label: '项目审核', to: '/admin/submissions', icon: ClipboardCheck, cap: 'submission:read' },
  { key: 'moderation', label: '内容审核', to: '/admin/moderation', icon: Shield, cap: 'moderation:read' },
  { key: 'feedback', label: '评论反馈', to: '/admin/feedback', icon: MessageSquare, cap: 'feedback:manage' },
  { key: 'users', label: '用户权限', to: '/admin/users', icon: Users, cap: 'user:read' },
  { key: 'media', label: '图床管理', to: '/admin/media', icon: Image, cap: 'media:read' },
  { key: 'audit', label: '审计日志', to: '/admin/audit', icon: ScrollText, cap: 'audit:read' },
];

const visibleItems = computed(() => allItems.filter(item => hasCapability(item.cap)));

const isActive = (key: string) => {
  const path = route.path;
  if (key === 'dashboard') return path === '/admin' || path === '/admin/dashboard';
  return path.startsWith(`/admin/${key}`);
};
</script>
```

- [ ] **Step 2: 创建 AdminBottomNav.vue**

移动端底部导航，同样按 Capability 过滤：

```vue
<template>
  <div class="fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200 dark:border-slate-700 safe-area-pb">
    <div class="flex overflow-x-auto px-2 py-1 gap-1 scrollbar-hide">
      <button
        v-for="item in visibleItems"
        :key="item.key"
        @click="$router.push(item.to)"
        class="flex flex-col items-center justify-center min-w-[3.5rem] px-2 py-1.5 rounded-lg transition-colors flex-shrink-0"
        :class="isActive(item.key) ? 'text-emerald-500' : 'text-slate-400'"
      >
        <component :is="item.icon" class="w-5 h-5" />
        <span class="text-[10px] mt-0.5 whitespace-nowrap">{{ item.label }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuth } from '../../composables/useAuth';
import {
  LayoutDashboard, FileText, Package, ClipboardCheck,
  Shield, MessageSquare, Users, Image, ScrollText,
} from 'lucide-vue-next';

const route = useRoute();
const { hasCapability } = useAuth();

const allItems = [
  { key: 'dashboard', label: '总览', to: '/admin/dashboard', icon: LayoutDashboard, cap: 'admin_panel_access' },
  { key: 'stories', label: '文章', to: '/admin/stories', icon: FileText, cap: 'story:manage' },
  { key: 'projects', label: '项目', to: '/admin/projects', icon: Package, cap: 'project:read' },
  { key: 'submissions', label: '审核', to: '/admin/submissions', icon: ClipboardCheck, cap: 'submission:read' },
  { key: 'moderation', label: '内容', to: '/admin/moderation', icon: Shield, cap: 'moderation:read' },
  { key: 'feedback', label: '反馈', to: '/admin/feedback', icon: MessageSquare, cap: 'feedback:manage' },
  { key: 'users', label: '用户', to: '/admin/users', icon: Users, cap: 'user:read' },
  { key: 'media', label: '图床', to: '/admin/media', icon: Image, cap: 'media:read' },
  { key: 'audit', label: '日志', to: '/admin/audit', icon: ScrollText, cap: 'audit:read' },
];

const visibleItems = computed(() => allItems.filter(item => hasCapability(item.cap)));

const isActive = (key: string) => {
  const path = route.path;
  if (key === 'dashboard') return path === '/admin' || path === '/admin/dashboard';
  return path.startsWith(`/admin/${key}`);
};
</script>
```

- [ ] **Step 3: 创建 AdminLayout.vue**

```vue
<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white flex">
    <AdminSidebar @logout="handleLogout" />

    <div class="flex-1 flex flex-col min-h-screen lg:min-w-0">
      <!-- Top bar -->
      <header class="sticky top-0 z-40 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-700 px-4 lg:px-6 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <h2 class="text-base lg:text-lg font-bold text-slate-900 dark:text-white">{{ currentTitle }}</h2>
        </div>
        <div class="flex items-center gap-2">
          <span v-if="authUser" class="text-sm text-slate-500 dark:text-slate-400 hidden sm:inline">{{ authUser.name }}</span>
          <button @click="router.push('/')" class="px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            返回首页
          </button>
          <button @click="handleLogout" class="px-3 py-1.5 rounded-lg text-sm font-medium bg-rose-500 hover:bg-rose-600 text-white transition-colors">
            退出
          </button>
        </div>
      </header>

      <!-- Content -->
      <main class="flex-1 p-4 lg:p-6 pb-20 lg:pb-6">
        <router-view />
      </main>
    </div>

    <AdminBottomNav />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuth } from '../../composables/useAuth';
import AdminSidebar from '../../components/admin/AdminSidebar.vue';
import AdminBottomNav from '../../components/admin/AdminBottomNav.vue';

const router = useRouter();
const route = useRoute();
const { user: authUser, logout } = useAuth();

const currentTitle = computed(() => {
  const meta = route.meta as any;
  return meta?.title || '管理后台';
});

const handleLogout = async () => {
  await logout();
  router.push('/');
};
</script>
```

- [ ] **Step 4: 验证前端编译**

Run: `cd frontend && npx vue-tsc --noEmit 2>&1 | head -20`
Expected: 无 AdminLayout/AdminSidebar/AdminBottomNav 相关错误

- [ ] **Step 5: 提交**

```bash
git add frontend/src/views/admin/AdminLayout.vue frontend/src/components/admin/AdminSidebar.vue frontend/src/components/admin/AdminBottomNav.vue
git commit -m "feat(admin): 创建 AdminLayout、侧边栏和底部导航组件"
```

---

## Task 6: 前端 — 创建 DashboardView 和 DashboardCard

**Files:**
- Create: `frontend/src/views/admin/DashboardView.vue`
- Create: `frontend/src/components/admin/DashboardCard.vue`

- [ ] **Step 1: 创建 DashboardCard.vue**

```vue
<template>
  <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
    <div class="flex items-center gap-3 mb-3">
      <div class="w-10 h-10 rounded-xl flex items-center justify-center" :class="iconBgClass">
        <component :is="icon" class="w-5 h-5" :class="iconTextClass" />
      </div>
      <span class="text-sm font-medium text-slate-500 dark:text-slate-400">{{ label }}</span>
    </div>
    <div class="text-2xl font-extrabold text-slate-900 dark:text-white">{{ mainValue }}</div>
    <div v-if="subValue" class="text-xs text-slate-400 mt-1">{{ subValue }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  label: string;
  mainValue: string | number;
  subValue?: string;
  icon: any;
  color?: 'emerald' | 'amber' | 'blue' | 'rose' | 'purple' | 'teal';
}>();

const colorMap: Record<string, { bg: string; text: string }> = {
  emerald: { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400' },
  amber: { bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-600 dark:text-amber-400' },
  blue: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400' },
  rose: { bg: 'bg-rose-100 dark:bg-rose-500/20', text: 'text-rose-600 dark:text-rose-400' },
  purple: { bg: 'bg-purple-100 dark:bg-purple-500/20', text: 'text-purple-600 dark:text-purple-400' },
  teal: { bg: 'bg-teal-100 dark:bg-teal-500/20', text: 'text-teal-600 dark:text-teal-400' },
};

const c = colorMap[props.color ?? 'emerald'];
const iconBgClass = computed(() => c.bg);
const iconTextClass = computed(() => c.text);
</script>
```

- [ ] **Step 2: 创建 DashboardView.vue**

```vue
<template>
  <div class="space-y-6">
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <DashboardCard v-if="hasCapability('project:read')" label="项目总数" :main-value="data.projects?.total ?? '—'" :sub-value="data.projects ? `本周新增 ${data.projects.newThisWeek}` : ''" :icon="Package" color="blue" />
      <DashboardCard v-if="hasCapability('submission:read')" label="待审核提交" :main-value="data.pendingSubmissions ?? '—'" :icon="ClipboardCheck" color="amber" />
      <DashboardCard v-if="hasCapability('moderation:read')" label="待审核内容" :main-value="moderationTotal" :sub-value="data.pendingModeration ? `评论 ${data.pendingModeration.comments} / Bug ${data.pendingModeration.bugs}` : ''" :icon="Shield" color="rose" />
      <DashboardCard v-if="hasCapability('feedback:manage')" label="待处理反馈" :main-value="data.openFeedback ?? '—'" :icon="MessageSquare" color="purple" />
      <DashboardCard v-if="hasCapability('user:read')" label="用户总数" :main-value="data.users?.total ?? '—'" :sub-value="data.users ? `本周注册 ${data.users.newThisWeek}` : ''" :icon="Users" color="teal" />
      <DashboardCard v-if="hasCapability('media:read')" label="媒体资产" :main-value="data.media?.total ?? '—'" :sub-value="data.media ? formatBytes(data.media.totalSize) : ''" :icon="ImageIcon" color="emerald" />
      <DashboardCard v-if="hasCapability('story:manage')" label="文章数" :main-value="data.stories ?? '—'" :icon="FileText" color="blue" />
    </div>

    <div v-if="hasCapability('audit:read') && data.recentActivity?.length" class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
      <h3 class="font-bold text-base mb-4">最近活动</h3>
      <div class="space-y-3">
        <div v-for="(item, i) in data.recentActivity" :key="i" class="flex items-start gap-3 text-sm">
          <span class="text-slate-400 whitespace-nowrap">{{ formatTime(item.created_at) }}</span>
          <span class="text-slate-700 dark:text-slate-300">{{ item.actor }}</span>
          <span class="text-slate-500 dark:text-slate-400">{{ item.action }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useAuth } from '../../composables/useAuth';
import { useAdminFetch } from '../../composables/useAdminFetch';
import DashboardCard from '../../components/admin/DashboardCard.vue';
import { Package, ClipboardCheck, Shield, MessageSquare, Users, Image as ImageIcon, FileText } from 'lucide-vue-next';

const { hasCapability } = useAuth();
const { adminFetch, formatBytes } = useAdminFetch();

const data = ref<Record<string, any>>({});

const moderationTotal = computed(() => {
  const m = data.value.pendingModeration;
  if (!m) return '—';
  return (m.comments + m.bugs);
});

const formatTime = (v: string) => {
  try {
    const d = new Date(v);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin}分钟前`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}小时前`;
    return d.toLocaleDateString('zh-CN');
  } catch {
    return v;
  }
};

onMounted(async () => {
  try {
    const res = await adminFetch('/api/admin/dashboard');
    if (res.ok) {
      data.value = await res.json();
    }
  } catch {}
});
</script>
```

- [ ] **Step 3: 验证前端编译**

Run: `cd frontend && npx vue-tsc --noEmit 2>&1 | head -20`
Expected: 无 DashboardView 相关错误

- [ ] **Step 4: 提交**

```bash
git add frontend/src/views/admin/DashboardView.vue frontend/src/components/admin/DashboardCard.vue
git commit -m "feat(admin): 创建总览看板页面和指标卡片组件"
```

---

## Task 7: 前端 — 从 AdminView 提取各模块视图

**Files:**
- Create: `frontend/src/views/admin/StoriesView.vue`
- Create: `frontend/src/views/admin/ProjectsView.vue`
- Create: `frontend/src/views/admin/SubmissionsView.vue`
- Create: `frontend/src/views/admin/ModerationView.vue`
- Create: `frontend/src/views/admin/FeedbackView.vue`
- Create: `frontend/src/views/admin/AuditView.vue`

这是工作量最大的 Task。每个视图从 AdminView.vue 中提取对应的模板、状态和逻辑。

**提取原则：**
- 每个 View 使用 `useAdminFetch()` composable 获取 `adminFetch` 等工具函数
- 每个 View 使用 `useAuth()` 获取用户信息
- 将 AdminView.vue 中对应 Tab 的 `<template>` 部分提取为该 View 的模板
- 将对应的 `ref`、`computed`、函数提取为该 View 的 `<script setup>`
- 移动端适配逻辑（`isMobile`、`mobileView`、`openDetail`、`backToList`）在每个 View 中独立实现

- [ ] **Step 1: 创建 StoriesView.vue**

从 AdminView.vue 提取 stories Tab 的模板（第 136-243 行区域）和对应的脚本逻辑（stories、selectedIndex、viewMode、isSaving、currentStory、renderedMarkdown、saveStories、selectStory、createNewStory、uploadBanner、uploadImageToMarkdown、insertText 等）。

- [ ] **Step 2: 创建 ProjectsView.vue**

从 AdminView.vue 提取 projects Tab 的模板（第 246-520 行区域）和对应的脚本逻辑（projectsPage、projectQuery、selectedProjectId、projectDraft、projectMobileStep、fetchAdminProjects、saveProjects、createNewProject、deleteCurrentProject、importProjectsJson、importProjectsCsv、exportJson、exportCsv、openCategoryManager、openRevisions、rollbackToRevision 等）。

- [ ] **Step 3: 创建 SubmissionsView.vue**

从 AdminView.vue 提取 submissions Tab 的模板（第 526-637 行区域）和对应的脚本逻辑（submissionsPage、submissionQuery、selectedSubmissionId、submissionDraft、submissionKind、submissionReviewNote、fetchSubmissions、selectSubmission、approveSubmission、rejectSubmission 等）。

- [ ] **Step 4: 创建 ModerationView.vue**

从 AdminView.vue 提取 moderation Tab 的模板（第 643-745 行区域）和对应的脚本逻辑（moderationKind、moderationStatus、moderationPage、moderationDraft、moderationReviewNote、fetchModeration、selectModeration、approveModeration、rejectModeration 等）。

- [ ] **Step 5: 创建 FeedbackView.vue**

```vue
<template>
  <div class="max-w-5xl mx-auto">
    <CommentPanel project-name="__admin__" variant="ops" initial-tab="bug" />
  </div>
</template>

<script setup lang="ts">
import CommentPanel from '../../components/CommentPanel.vue';
</script>
```

- [ ] **Step 6: 创建 AuditView.vue**

从 AdminView.vue 提取审计日志弹窗的模板和逻辑（auditPage、openAuditLogs 等），提升为完整页面视图。

- [ ] **Step 7: 验证前端编译**

Run: `cd frontend && npx vue-tsc --noEmit 2>&1 | head -30`
Expected: 无新视图组件相关错误

- [ ] **Step 8: 提交**

```bash
git add frontend/src/views/admin/StoriesView.vue frontend/src/views/admin/ProjectsView.vue frontend/src/views/admin/SubmissionsView.vue frontend/src/views/admin/ModerationView.vue frontend/src/views/admin/FeedbackView.vue frontend/src/views/admin/AuditView.vue
git commit -m "feat(admin): 从 AdminView 提取各模块为独立视图组件"
```

---

## Task 8: 前端 — 创建增强版 UsersView（角色模板 + 折叠式能力编辑器）

**Files:**
- Create: `frontend/src/views/admin/UsersView.vue`
- Create: `frontend/src/components/admin/CapabilityEditor.vue`

- [ ] **Step 1: 创建 CapabilityEditor.vue**

折叠式能力编辑器组件，按分类分组，支持角色模板一键填充：

```vue
<template>
  <div class="space-y-2">
    <div class="flex items-center gap-3 mb-3">
      <label class="text-sm font-bold text-slate-700 dark:text-slate-300">角色模板</label>
      <select v-model="selectedTemplate" @change="applyTemplate" class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">
        <option value="">自定义</option>
        <option v-for="(tpl, key) in templates" :key="key" :value="key">{{ tpl.name }}</option>
      </select>
      <div class="flex gap-2 ml-auto">
        <button @click="selectAll" class="text-xs text-emerald-500 hover:underline">全选</button>
        <button @click="deselectAll" class="text-xs text-slate-400 hover:underline">清空</button>
      </div>
    </div>

    <div v-for="group in groups" :key="group.category" class="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <button
        @click="toggleGroup(group.category)"
        class="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
      >
        <div class="flex items-center gap-2">
          <span :class="groupHasAny(group) ? 'text-emerald-500' : 'text-slate-300'">
            {{ groupHasAny(group) ? '✅' : '☐' }}
          </span>
          <span>{{ groupLabels[group.category] || group.category }}</span>
          <span class="text-xs text-slate-400">({{ group.items.filter(c => modelValue.includes(c.id)).length }}/{{ group.items.length }})</span>
        </div>
        <component :is="expandedGroups.has(group.category) ? ChevronUp : ChevronDown" class="w-4 h-4 text-slate-400" />
      </button>
      <div v-if="expandedGroups.has(group.category)" class="px-4 pb-3 space-y-2">
        <label v-for="cap in group.items" :key="cap.id" class="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" :checked="modelValue.includes(cap.id)" @change="toggleCap(cap.id)" class="rounded border-slate-300 text-emerald-500 focus:ring-emerald-500" />
          <span class="text-slate-700 dark:text-slate-300">{{ cap.name }}</span>
          <span class="text-xs text-slate-400">{{ cap.description }}</span>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ChevronUp, ChevronDown } from 'lucide-vue-next';

type Capability = { id: string; name: string; category: string; description: string };
type RoleTemplate = { name: string; capabilityIds: string[] };

const props = defineProps<{
  modelValue: string[];
  allCapabilities: Capability[];
  templates: Record<string, RoleTemplate>;
  disabled?: boolean;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>();

const expandedGroups = ref(new Set<string>());
const selectedTemplate = ref('');

const groupLabels: Record<string, string> = {
  panel: '面板访问',
  project: '项目管理',
  category: '分类管理',
  submission: '提交审核',
  moderation: '内容审核',
  user: '用户管理',
  audit: '审计日志',
  story: '故事管理',
  feedback: '反馈管理',
  comment: '评论管理',
  media: '媒体管理',
};

const groups = computed(() => {
  const map = new Map<string, Capability[]>();
  for (const cap of props.allCapabilities) {
    const list = map.get(cap.category) || [];
    list.push(cap);
    map.set(cap.category, list);
  }
  return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
});

const groupHasAny = (group: { category: string; items: Capability[] }) => {
  return group.items.some(c => props.modelValue.includes(c.id));
};

const toggleGroup = (category: string) => {
  const next = new Set(expandedGroups.value);
  if (next.has(category)) next.delete(category);
  else next.add(category);
  expandedGroups.value = next;
};

const toggleCap = (capId: string) => {
  const next = props.modelValue.includes(capId)
    ? props.modelValue.filter(id => id !== capId)
    : [...props.modelValue, capId];
  emit('update:modelValue', next);
};

const applyTemplate = () => {
  if (!selectedTemplate.value) return;
  const tpl = props.templates[selectedTemplate.value];
  if (tpl) emit('update:modelValue', [...tpl.capabilityIds]);
};

const selectAll = () => emit('update:modelValue', props.allCapabilities.map(c => c.id));
const deselectAll = () => emit('update:modelValue', []);
</script>
```

- [ ] **Step 2: 创建增强版 UsersView.vue**

从 AdminView.vue 提取 users Tab 的模板和逻辑，集成 CapabilityEditor 组件和角色模板功能。关键增强点：

1. 用户详情面板中嵌入 `<CapabilityEditor>` 组件
2. 加载角色模板列表（从 `/api/admin/role-templates` API）
3. 保存能力时调用 `PUT /api/admin/users/:id/capabilities`
4. 超级管理员显示"拥有全部权限"徽章，禁止编辑能力

- [ ] **Step 3: 验证前端编译**

Run: `cd frontend && npx vue-tsc --noEmit 2>&1 | head -20`
Expected: 无 UsersView/CapabilityEditor 相关错误

- [ ] **Step 4: 提交**

```bash
git add frontend/src/views/admin/UsersView.vue frontend/src/components/admin/CapabilityEditor.vue
git commit -m "feat(admin): 创建增强版用户权限管理页和折叠式能力编辑器"
```

---

## Task 9: 前端 — 创建增强版 MediaView（标签、搜索、批量操作）

**Files:**
- Create: `frontend/src/views/admin/MediaView.vue`
- Create: `frontend/src/components/admin/MediaTagInput.vue`
- Create: `frontend/src/components/admin/MediaBatchActions.vue`

- [ ] **Step 1: 创建 MediaTagInput.vue**

标签输入 Chip 组件：

```vue
<template>
  <div class="flex flex-wrap gap-1.5 items-center">
    <span
      v-for="tag in modelValue"
      :key="tag"
      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
    >
      {{ tag }}
      <button v-if="!disabled" @click="removeTag(tag)" class="hover:text-rose-500">&times;</button>
    </span>
    <input
      v-if="!disabled"
      v-model="newTag"
      @keydown.enter.prevent="addTag"
      class="px-2 py-0.5 rounded text-xs border border-slate-200 dark:border-slate-700 bg-transparent outline-none focus:border-emerald-500 w-20"
      placeholder="+ 标签"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  modelValue: string[];
  disabled?: boolean;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>();

const newTag = ref('');

const addTag = () => {
  const tag = newTag.value.trim();
  if (!tag || props.modelValue.includes(tag)) return;
  emit('update:modelValue', [...props.modelValue, tag]);
  newTag.value = '';
};

const removeTag = (tag: string) => {
  emit('update:modelValue', props.modelValue.filter(t => t !== tag));
};
</script>
```

- [ ] **Step 2: 创建 MediaBatchActions.vue**

批量操作工具栏组件：

```vue
<template>
  <div v-if="selectedIds.length > 0" class="flex items-center gap-3 px-4 py-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl">
    <span class="text-sm font-medium text-emerald-700 dark:text-emerald-300">已选 {{ selectedIds.length }} 项</span>
    <button @click="$emit('batchTag')" class="px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-colors">
      批量打标签
    </button>
    <button @click="$emit('batchDelete')" class="px-3 py-1.5 rounded-lg text-sm font-medium bg-rose-500 text-white hover:bg-rose-600 transition-colors">
      批量删除
    </button>
    <button @click="$emit('clearSelection')" class="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
      取消选择
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{ selectedIds: string[] }>();
defineEmits<{ batchTag: []; batchDelete: []; clearSelection: [] }>();
</script>
```

- [ ] **Step 3: 创建增强版 MediaView.vue**

从 AdminView.vue 提取 media Tab 的模板和逻辑，集成以下增强功能：

1. **标签系统**：每个媒体项显示 `<MediaTagInput>`，修改时调用 `PATCH /api/admin/media/:id/tags`
2. **搜索过滤**：新增标签过滤下拉、MIME 类型过滤
3. **引用关系可视化**：每个媒体项显示引用计数，点击展开引用列表
4. **批量操作**：列表项增加复选框，顶部显示 `<MediaBatchActions>`，调用批量 API

- [ ] **Step 4: 验证前端编译**

Run: `cd frontend && npx vue-tsc --noEmit 2>&1 | head -20`
Expected: 无 MediaView 相关错误

- [ ] **Step 5: 提交**

```bash
git add frontend/src/views/admin/MediaView.vue frontend/src/components/admin/MediaTagInput.vue frontend/src/components/admin/MediaBatchActions.vue
git commit -m "feat(admin): 创建增强版图床管理页，支持标签、搜索、批量操作"
```

---

## Task 10: 清理 — 删除旧 AdminView 和废弃代码

**Files:**
- Delete: `frontend/src/views/AdminView.vue`
- Modify: `frontend/src/router/index.ts`（移除旧 AdminView import）
- Modify: `backend/src/plugins/auth.ts`（移除 `requireRole` 和 `requireAuthOrDev`）

- [ ] **Step 1: 删除 AdminView.vue**

```bash
rm frontend/src/views/AdminView.vue
```

- [ ] **Step 2: 从 router/index.ts 移除旧 AdminView import**

删除 `import AdminView from '../views/AdminView.vue'` 行。

- [ ] **Step 3: 从 auth.ts 移除废弃函数**

删除 `requireRole` 和 `requireAuthOrDev` 函数定义。

- [ ] **Step 4: 从 index.ts 移除废弃 import**

删除 `import { ..., requireRole, ... } from "./plugins/auth"` 中的 `requireRole`。

- [ ] **Step 5: 全局搜索 requireRole 和 requireAuthOrDev 的使用**

Run: `cd backend && grep -rn "requireRole\|requireAuthOrDev" src/`
Expected: 无结果（或仅在注释中）

- [ ] **Step 6: 验证完整编译**

Run: `cd frontend && npx vue-tsc --noEmit 2>&1 | head -20`
Run: `cd backend && npx tsc --noEmit 2>&1 | head -20`
Expected: 均无错误

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "refactor(admin): 删除旧 AdminView 和废弃的 requireRole/requireAuthOrDev"
```

---

## Task 11: 端到端验证

- [ ] **Step 1: 启动后端**

Run: `cd backend && npm run dev`
Expected: 服务启动成功，无迁移错误

- [ ] **Step 2: 启动前端**

Run: `cd frontend && npm run dev`
Expected: Vite 启动成功

- [ ] **Step 3: 验证路由跳转**

访问 `/admin` → 自动跳转到 `/admin/dashboard`
访问 `/admin/stories` → 文章管理页
访问 `/admin/users` → 用户权限管理页
访问 `/admin/media` → 图床管理页

- [ ] **Step 4: 验证权限控制**

使用只有部分 Capability 的用户登录，确认侧边栏只显示有权限的模块。

- [ ] **Step 5: 验证移动端**

在浏览器中缩小窗口到 < 1024px，确认底部导航显示，侧边栏隐藏。

- [ ] **Step 6: 提交最终状态**

```bash
git add -A
git commit -m "chore(admin): 端到端验证完成"
```
