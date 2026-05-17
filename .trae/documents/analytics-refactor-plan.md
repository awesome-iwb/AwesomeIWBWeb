# 数据分析模块重构计划

## 问题诊断

当前实现存在以下问题：

1. **结构问题**：数据分析只嵌入在总览面板中，没有独立页面。用户要求"总览有摘要 + 独立选项卡有完整分析"
2. **页面名称问题**：热力图和热门页面直接显示原始路由路径（如 `/project/classisland`），不直观，应显示人类可读名称（如"ClassIsland 项目详情"）
3. **后台页面未排除**：`/admin/*`、`/dev/*` 等后台页面不应出现在面向用户的数据分析中
4. **图表类型单一**：缺少词云图、日历热力图等丰富可视化
5. **搜索词只用了柱状图**：应改为词云图更直观

## 改进方案

### 步骤 1：后端 — 过滤后台页面 + 返回可读页面名

**文件**：`backend/src/services/analytics.ts`

修改 `getAnalyticsOverview` 中的 `topPages` 和 `categoryDistribution` 查询：

1. **排除后台路由**：在所有 `page_views` 查询中添加 `WHERE path NOT LIKE '/admin%' AND path NOT LIKE '/dev%' AND path NOT LIKE '/api%'` 条件
2. **topPages 返回可读名称**：SQL 中用 CASE 将路径转为可读名称：
   ```sql
   CASE
     WHEN path = '/' THEN '首页'
     WHEN path = '/categories' THEN '分类浏览'
     WHEN path = '/today' THEN '今日推荐'
     WHEN path = '/compare' THEN '项目对比'
     WHEN path = '/submit' THEN '提交项目'
     WHEN path = '/me' THEN '个人中心'
     WHEN path LIKE '/project/%' THEN replace(substring(path from '/project/(.*)'), '-', ' ') || ' · 项目详情'
     ELSE path
   END as display_name
   ```
   返回类型从 `{ path, count }` 改为 `{ path, displayName, count }`
3. **categoryDistribution 排除后台**：移除 `管理后台` 和 `开发者面板` 分类
4. **新增 hourlyDistribution 查询**：返回 24 小时访问分布（0-23 点），用于日历热力图/时段分布图
5. **新增 weeklyDistribution 查询**：返回周一到周日的访问分布，用于周活跃度分析
6. **topProjects 返回项目名**：JOIN projects 表获取 name 字段，返回 `{ slug, name, clicks, downloads }`

### 步骤 2：后端 — 新增 API 返回字段

`AnalyticsOverview` 类型新增：
```typescript
hourlyDistribution: Array<{ hour: number; pv: number; uv: number }>;
weeklyDistribution: Array<{ weekday: number; pv: number }>;
topPages: Array<{ path: string; displayName: string; count: number }>;
topProjects: Array<{ slug: string; name: string; clicks: number; downloads: number }>;
```

### 步骤 3：前端 — 创建独立 AnalyticsView 页面

**文件**：`frontend/src/views/admin/AnalyticsView.vue`（新建）

独立页面布局（比总览摘要更丰富）：

```
┌──────────────────────────────────────────────────────────┐
│ 数据分析                              [7天|30天|90天]     │
├──────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│ │ 页面浏览  │ │ 独立访客  │ │ 项目点击  │ │ 搜索次数  │    │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
├──────────────────────────────────────────────────────────┤
│ ┌───────────────────────┐ ┌───────────────────────┐     │
│ │  浏览趋势（面积折线图） │ │  时段活跃度（柱状图）  │     │
│ │  PV/UV 双线 + 面积填充  │ │  24小时 PV 分布       │     │
│ └───────────────────────┘ └───────────────────────┘     │
├──────────────────────────────────────────────────────────┤
│ ┌───────────────────────┐ ┌───────────────────────┐     │
│ │  页面热力图（矩形树图） │ │  搜索词云（词云图）    │     │
│ │  显示可读名称，排除后台  │ │  字号=频率，颜色=热度  │     │
│ └───────────────────────┘ └───────────────────────┘     │
├──────────────────────────────────────────────────────────┤
│ ┌───────────────────────┐ ┌───────────────────────┐     │
│ │  热门项目（堆叠柱状图） │ │  周活跃度（雷达图）    │     │
│ │  点击+下载，显示项目名  │ │  周一到周日 PV 分布    │     │
│ └───────────────────────┘ └───────────────────────┘     │
├──────────────────────────────────────────────────────────┤
│ ┌───────────────────────┐ ┌───────────────────────┐     │
│ │  分类浏览占比（玫瑰图） │ │  热门页面排行（列表）  │     │
│ │  环形饼图，排除后台    │ │  显示可读名称+PV数     │     │
│ └───────────────────────┘ └───────────────────────┘     │
└──────────────────────────────────────────────────────────┘
```

图表类型丰富化：
1. **浏览趋势** — 面积折线图（LineChart + areaStyle），PV/UV 双线
2. **时段活跃度** — 柱状图（BarChart），24 小时 PV 分布，渐变色
3. **页面热力图** — 矩形树图（TreemapChart），显示可读名称，排除后台
4. **搜索词云** — 词云图（WordCloudChart），需要 echarts-wordcloud 插件
5. **热门项目** — 堆叠横向柱状图（BarChart），显示项目名而非 slug
6. **周活跃度** — 雷达图（RadarChart），周一到周日
7. **分类浏览占比** — 玫瑰图/环形饼图（PieChart + roseType），排除后台
8. **热门页面排行** — 列表，显示可读名称

### 步骤 4：前端 — 安装 echarts-wordcloud

```bash
cd frontend && npm install echarts-wordcloud
```

词云图需要这个 ECharts 扩展。在 AnalyticsView 中注册：
```typescript
import 'echarts-wordcloud';
```

### 步骤 5：前端 — DashboardView 保留摘要模块

**文件**：`frontend/src/views/admin/DashboardView.vue`

总览面板中保留精简版数据分析模块，只显示：
- 4 个指标卡片（PV/UV/点击/搜索）
- 浏览趋势折线图（小尺寸）
- 页面热力图（小尺寸，显示可读名称）
- 标题栏增加"查看完整分析 →"链接，跳转到 `/admin/analytics`

移除 DashboardView 中的热门项目、热门搜索词、分类占比、热门页面列表（这些只在独立页面展示）。

### 步骤 6：前端 — 注册路由和导航

**文件**：修改 `frontend/src/router/index.ts`

```typescript
{ path: 'analytics', name: 'admin-analytics', component: () => import('../views/admin/AnalyticsView.vue'), meta: { title: '数据分析', requiresCapability: 'analytics:read' } },
```

**文件**：修改 `AdminSidebar.vue` 和 `AdminBottomNav.vue`

添加"数据分析"导航入口，使用 BarChart3 图标，需要 `analytics:read` 权限。

---

## 文件变更清单

| 操作 | 文件路径 | 说明 |
|------|---------|------|
| 修改 | `backend/src/services/analytics.ts` | 排除后台路由 + 可读名称 + 新增时段/周分布查询 + 项目名 |
| 修改 | `frontend/src/views/admin/DashboardView.vue` | 精简为摘要模块 + 添加"查看完整分析"链接 |
| 新建 | `frontend/src/views/admin/AnalyticsView.vue` | 独立完整分析页面（8种图表） |
| 修改 | `frontend/src/router/index.ts` | 注册 analytics 路由 |
| 修改 | `frontend/src/components/admin/AdminSidebar.vue` | 添加数据分析导航 |
| 修改 | `frontend/src/components/admin/AdminBottomNav.vue` | 添加数据分析导航 |
| 安装 | `echarts-wordcloud` | 词云图依赖 |

## 关键设计决策

1. **页面名称映射**：后端 SQL 中用 CASE 语句做路径→可读名称的映射，项目详情页提取 slug 并格式化
2. **后台排除**：所有面向用户的查询都排除 `/admin*`、`/dev*`、`/api*` 路径
3. **词云实现**：使用 echarts-wordcloud 插件，搜索词字号与搜索次数成正比
4. **雷达图**：周活跃度用雷达图展示，比柱状图更直观地展示"哪天最活跃"
5. **总览 vs 独立页**：总览只展示 4 指标 + 趋势 + 热力图，独立页展示全部 8 种图表
