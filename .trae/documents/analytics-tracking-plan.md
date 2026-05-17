# 网站数据分析与统计系统实施计划

## 概述

为 Awesome-IWB 网站引入轻量级用户行为追踪系统，包括页面访问统计、项目点击/下载追踪、搜索关键词统计，并在运维后台提供数据可视化（含热力图）。

## 技术方案

- **后端**：在 Elysia 中间件层自动记录 PV，新增 `/api/track/*` 公开端点接收前端 beacon
- **数据库**：新增 3 张表（page_views、click_events、search_queries），通过 migration 创建
- **前端追踪**：使用 `navigator.sendBeacon()` 发送，不阻塞 UI，无需额外依赖
- **后台可视化**：复用已有 ECharts + vue-echarts，新增 AnalyticsView 页面
- **热力图**：基于页面 PV 数据按路由聚合，用 ECharts 矩形树图（treemap）或热力矩阵展示

---

## 实施步骤

### 步骤 1：数据库 Migration — 创建统计表

**文件**：`backend/migrations/0031_analytics.sql`

创建三张表：

```sql
-- 页面访问记录
CREATE TABLE page_views (
  id BIGSERIAL PRIMARY KEY,
  path TEXT NOT NULL,
  referrer TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_page_views_path ON page_views(path);
CREATE INDEX idx_page_views_created_at ON page_views(created_at);

-- 点击事件（项目点击、下载等）
CREATE TABLE click_events (
  id BIGSERIAL PRIMARY KEY,
  project_slug TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'click',  -- 'click' | 'download' | 'github'
  referrer TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_click_events_project_slug ON click_events(project_slug);
CREATE INDEX idx_click_events_created_at ON click_events(created_at);
CREATE INDEX idx_click_events_type ON click_events(event_type);

-- 搜索关键词记录
CREATE TABLE search_queries (
  id BIGSERIAL PRIMARY KEY,
  query TEXT NOT NULL,
  results_count INTEGER NOT NULL DEFAULT 0,
  user_agent TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_search_queries_query ON search_queries(query);
CREATE INDEX idx_search_queries_created_at ON search_queries(created_at);
```

### 步骤 2：后端 — 创建 analytics service

**文件**：`backend/src/services/analytics.ts`

提供以下函数：
- `recordPageView(data: { path, referrer, userAgent, ip })` — 插入 page_views
- `recordClickEvent(data: { projectSlug, eventType, referrer, userAgent, ip })` — 插入 click_events
- `recordSearchQuery(data: { query, resultsCount, userAgent, ip })` — 插入 search_queries
- `getAnalyticsOverview(days: number)` — 返回指定天数的汇总数据：
  - 总 PV / UV（按 IP 去重）
  - 每日 PV 趋势（数组，用于折线图）
  - 热门页面 Top N（用于热力图数据源）
  - 热门项目点击 Top N
  - 热门搜索词 Top N
  - 分类浏览占比
- `getPageViewsByRoute(days: number)` — 按路由聚合 PV，返回热力图数据
- `getClickStatsByProject(days: number)` — 按项目聚合点击/下载数
- `getSearchStats(days: number)` — 搜索词统计

所有写入操作使用 `sql()...execute()` 异步执行，不阻塞主流程。读取操作使用 SQL 聚合查询。

### 步骤 3：后端 — 添加追踪 API 端点

**文件**：修改 `backend/src/index.ts`

新增 3 个 public 端点：

```
POST /api/track/pageview   — 记录页面访问
POST /api/track/click      — 记录项目点击/下载
POST /api/track/search     — 记录搜索关键词
```

这些端点：
- 无需认证（public scope）
- 应用 rate limit 防止滥用
- 从请求中提取 IP（x-forwarded-for / x-real-ip）、User-Agent
- 异步写入数据库，不阻塞响应
- 返回 `{ ok: true }` 即可

新增 1 个 admin 端点：

```
GET /api/admin/analytics?days=7  — 获取分析数据
```

需要 `analytics:read` 权限（新增 capability）。

同时在 `apiRegistry.ts` 中注册这些路由。

### 步骤 4：后端 — 添加 PV 中间件

**文件**：修改 `backend/src/index.ts`

在 Elysia app 上添加 `onAfterHandle` 中间件，对非 API、非静态资源的 GET 请求自动记录 PV。但考虑到项目是 SSG（vite-ssg），前端页面请求实际由 Nginx 直接返回静态 HTML，不经过后端。因此 PV 追踪主要依赖前端 beacon 发送。

后端中间件仅作为补充，记录到达后端的 API 请求路径（用于分析 API 使用模式），不记录为 page_view。

### 步骤 5：后端 — 新增 analytics capability

**文件**：`backend/migrations/0031_analytics.sql`（追加到步骤1的文件中）

```sql
INSERT INTO capabilities (id, name, category, description, sort_index) VALUES
  ('analytics:read', '查看数据分析', 'admin.analytics', '查看网站访问统计和用户行为分析', 300)
ON CONFLICT (id) DO NOTHING;

-- 为所有已有 admin_panel_access 权限的用户授予 analytics:read
INSERT INTO user_capabilities (user_id, capability_id)
  SELECT uc.user_id, 'analytics:read'
  FROM user_capabilities uc
  WHERE uc.capability_id = 'admin_panel_access'
ON CONFLICT (user_id, capability_id) DO NOTHING;
```

### 步骤 6：前端 — 创建追踪 composable

**文件**：`frontend/src/composables/useAnalytics.ts`

```typescript
const API_BASE = import.meta.env.VITE_API_BASE || '';

export function useAnalytics() {
  const trackPageView = (path: string, referrer?: string) => {
    try {
      navigator.sendBeacon(
        `${API_BASE}/api/track/pageview`,
        JSON.stringify({ path, referrer: referrer || document.referrer })
      );
    } catch {}
  };

  const trackClick = (projectSlug: string, eventType: 'click' | 'download' | 'github') => {
    try {
      navigator.sendBeacon(
        `${API_BASE}/api/track/click`,
        JSON.stringify({ projectSlug, eventType })
      );
    } catch {}
  };

  const trackSearch = (query: string, resultsCount: number) => {
    if (!query.trim()) return;
    try {
      navigator.sendBeacon(
        `${API_BASE}/api/track/search`,
        JSON.stringify({ query: query.trim(), resultsCount })
      );
    } catch {}
  };

  return { trackPageView, trackClick, trackSearch };
}
```

### 步骤 7：前端 — 集成追踪到页面

#### 7.1 页面访问追踪

**文件**：修改 `frontend/src/App.vue` 或路由守卫

在 `router.afterEach` 中调用 `trackPageView(to.fullPath)`，记录每次路由切换。

#### 7.2 项目点击追踪

**文件**：修改 `frontend/src/views/HomeView.vue`、`CategoriesView.vue`、`FeaturedView.vue`

在项目卡片的点击处理函数中，导航前调用 `trackClick(project.slug || project.name, 'click')`。

#### 7.3 项目下载追踪

**文件**：修改 `frontend/src/views/ProjectDetailView.vue`

在 "Get App" 和 GitHub 链接上添加 `@click` 处理，调用 `trackClick(project.slug, 'download')` 或 `trackClick(project.slug, 'github')`。

#### 7.4 搜索关键词追踪

**文件**：修改 `frontend/src/components/CommandPalette.vue` 和 `HomeView.vue`

在搜索执行后调用 `trackSearch(query, results.length)`。添加防抖（debounce 500ms），避免每次按键都发送。

### 步骤 8：前端 — 创建 AnalyticsView 后台页面

**文件**：`frontend/src/views/admin/AnalyticsView.vue`

页面布局：

```
┌──────────────────────────────────────────────────────┐
│ 数据分析                                    [7天|30天|90天] │
├──────────────────────────────────────────────────────┤
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │
│ │ 总 PV  │ │ 总 UV  │ │ 项目点击│ │ 搜索次数│        │
│ │ 12,345 │ │ 3,456  │ │ 1,234  │ │  567   │        │
│ └────────┘ └────────┘ └────────┘ └────────┘        │
├──────────────────────────────────────────────────────┤
│ ┌─────────────────────┐ ┌─────────────────────┐     │
│ │   每日 PV 趋势图     │ │  页面热力图          │     │
│ │   (折线图 ECharts)   │ │  (矩形树图 treemap)  │     │
│ │                     │ │                     │     │
│ └─────────────────────┘ └─────────────────────┘     │
├──────────────────────────────────────────────────────┤
│ ┌─────────────────────┐ ┌─────────────────────┐     │
│ │  热门项目排行 Top10  │ │  热门搜索词 Top10   │     │
│ │  (横向柱状图)       │ │  (词云/柱状图)      │     │
│ └─────────────────────┘ └─────────────────────┘     │
├──────────────────────────────────────────────────────┤
│ ┌─────────────────────┐                             │
│ │  分类浏览占比        │                             │
│ │  (饼图)             │                             │
│ └─────────────────────┘                             │
└──────────────────────────────────────────────────────┘
```

ECharts 图表类型：
1. **每日 PV 趋势** — 折线图（LineChart），X轴日期，Y轴 PV/UV
2. **页面热力图** — 矩形树图（TreemapChart），每个矩形代表一个路由，面积=PV，颜色深浅=相对热度
3. **热门项目排行** — 横向柱状图（BarChart），显示项目名和点击数
4. **热门搜索词** — 横向柱状图或词云效果
5. **分类浏览占比** — 饼图（PieChart）

需要引入额外的 ECharts 组件：
```typescript
import { LineChart, BarChart, PieChart, TreemapChart } from 'echarts/charts';
import { GridComponent, VisualMapComponent } from 'echarts/components';
```

### 步骤 9：前端 — 注册路由和导航

**文件**：修改 `frontend/src/router/index.ts`

在 admin 子路由中添加：
```typescript
{
  path: 'analytics',
  name: 'admin-analytics',
  component: () => import('../views/admin/AnalyticsView.vue'),
  meta: { requiresAuth: true, requiresCapability: 'analytics:read', title: '数据分析' }
}
```

**文件**：修改 `frontend/src/components/admin/AdminSidebar.vue` 和 `AdminBottomNav.vue`

在导航中添加"数据分析"入口，使用 `BarChart3` 图标（来自 lucide-vue-next）。

### 步骤 10：后端 — 在 Dashboard 中增加分析摘要

**文件**：修改 `backend/src/services/dashboard.ts`

在 `getDashboardData` 返回值中增加 `analytics` 字段：
```typescript
analytics?: {
  pvToday: number;
  pvThisWeek: number;
  topProject: { slug: string; name: string; clicks: number } | null;
  topSearchQuery: string | null;
};
```

这样 DashboardView 首页也能看到今日 PV 等关键指标。

---

## 文件变更清单

| 操作 | 文件路径 |
|------|---------|
| 新建 | `backend/migrations/0031_analytics.sql` |
| 新建 | `backend/src/services/analytics.ts` |
| 修改 | `backend/src/index.ts` — 添加 track 端点和 admin/analytics 端点 |
| 修改 | `backend/src/apiRegistry.ts` — 注册新路由 |
| 修改 | `backend/src/services/dashboard.ts` — 增加 analytics 摘要 |
| 新建 | `frontend/src/composables/useAnalytics.ts` |
| 修改 | `frontend/src/App.vue` — 路由守卫中调用 trackPageView |
| 修改 | `frontend/src/views/HomeView.vue` — 项目点击追踪 + 搜索追踪 |
| 修改 | `frontend/src/views/CategoriesView.vue` — 项目点击追踪 |
| 修改 | `frontend/src/views/FeaturedView.vue` — 项目点击追踪 |
| 修改 | `frontend/src/views/ProjectDetailView.vue` — 下载/GitHub 链接追踪 |
| 修改 | `frontend/src/components/CommandPalette.vue` — 搜索追踪 |
| 新建 | `frontend/src/views/admin/AnalyticsView.vue` |
| 修改 | `frontend/src/router/index.ts` — 注册 analytics 路由 |
| 修改 | `frontend/src/components/admin/AdminSidebar.vue` — 添加导航入口 |
| 修改 | `frontend/src/components/admin/AdminBottomNav.vue` — 添加导航入口 |
| 修改 | `frontend/src/views/admin/DashboardView.vue` — 增加 PV 指标卡片 |

## 隐私与性能考量

1. **IP 脱敏**：数据库中仅存储 IP 前三段（如 `192.168.1.x`），不存储完整 IP
2. **User-Agent 截断**：仅保留前 200 字符
3. **数据保留**：建议后续添加定时清理任务，保留 90 天原始数据，90 天以上仅保留聚合数据
4. **Rate Limit**：track 端点使用更严格的 rate limit（每分钟 60 次）
5. **Beacon 优先**：前端使用 `navigator.sendBeacon()` 发送，页面卸载时也能可靠发送，不阻塞 UI
6. **异步写入**：后端写入使用 `setTimeout(fn, 0)` 或 fire-and-forget 模式，不阻塞 API 响应
