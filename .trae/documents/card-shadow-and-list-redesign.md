# 卡片阴影精简 + 列表项重设计 + 文章管理重构计划

## 一、问题诊断

### 1. 阴影过度使用
当前所有面板和卡片都使用 `shadow-xl shadow-slate-900/8 dark:shadow-black/30`，这种重型阴影在白色背景上显得沉重且廉价。澎湃 OS 3 的设计语言强调**轻量层次感**，应通过边框和微弱阴影来区分层级，而非浓重投影。

**问题文件：**
- `ListDetailLayout.vue`：列表面板和详情面板都有 `shadow-xl`
- `StoriesView.vue`：详情卡片有 `shadow-sm`（这个反而太轻了，不一致）
- 各视图的列表项选中态：`shadow-md shadow-emerald-500/20`（选中时加阴影是合理的，但太重）

### 2. 列表项设计不统一且丑陋
**9 个视图的列表项存在严重不一致：**

| 问题 | 涉及视图 |
|------|---------|
| 圆角不统一：列表项用 `rounded-xl`，外层面板用 `rounded-2xl`，胶囊用 `rounded-2xl` | 全部 |
| 列表项之间无间距或间距不统一（`space-y-2` vs `space-y-4`） | 全部 |
| 选中态颜色不统一：ProjectsView 用 `hover:border-blue-300`，其他用 `emerald-300`，ModerationView 用 `amber` | ProjectsView, ModerationView |
| 标题字重不统一：`font-medium` vs `font-bold` | Projects/Users/Media vs 其他 |
| 有图标 vs 无图标布局不统一 | Projects/Users/Developers/Media/Audit 有，其他无 |
| AuditView 用 `<button>` 而非 `<div>` | AuditView |
| 列表项选中态 `shadow-md shadow-emerald-500/20` 太重 | 全部 |

### 3. 文章管理（StoriesView）设计丑陋
- 列表项使用 `rounded-2xl`（比其他视图的 `rounded-xl` 更大），且选中态 `shadow-lg shadow-emerald-500/20` 最重
- 详情区域是一个嵌套的 `rounded-3xl` 卡片（在 `rounded-2xl` 面板内再套一个圆角卡片），层级混乱
- 编辑器工具栏设计简陋，按钮太小太密
- 空状态使用虚线边框 `border-2 border-dashed`，与其他页面的空状态风格不一致

### 4. 移动端胶囊设计问题
- 胶囊圆角 `rounded-2xl` 与列表项圆角 `rounded-xl` 不对齐
- 胶囊有 `shadow-lg`，太重
- 胶囊与详情内容之间没有视觉分隔

## 二、设计方案

### 设计原则（澎湃 OS 3 风格）
1. **阴影极简**：面板使用 `shadow-sm` 或无边框阴影，通过 1px 边框 + 背景色差异区分层级
2. **圆角统一**：列表项 `rounded-xl`（12px），面板/卡片 `rounded-2xl`（16px），胶囊 `rounded-xl`（12px）
3. **间距呼吸感**：列表项之间 `space-y-1.5`（6px），紧凑但不拥挤
4. **选中态轻量**：选中用品牌色左边框 + 浅品牌色背景，而非全色填充 + 阴影
5. **图标统一**：所有列表项都有图标/头像区域，保持视觉节奏一致

### 新列表项设计规范

**未选中态：**
```
┌──────────────────────────────┐
│ 🟢 项目名称                   │  ← 图标(32x32) + 标题(font-medium text-sm)
│    副标题信息                  │  ← 副标题(text-xs text-slate-500)
└──────────────────────────────┘
  bg-white dark:bg-slate-800/50
  border border-transparent
  rounded-xl p-3
  hover:bg-slate-50 dark:hover:bg-slate-800
```

**选中态：**
```
┌──────────────────────────────┐
│🟢 项目名称                   │  ← 左边3px品牌色边框 + 浅品牌色背景
│   副标题信息                  │
└──────────────────────────────┘
  bg-[var(--color-brand-50)] dark:bg-[var(--color-brand-500)]/10
  border-l-[3px] border-l-[var(--color-brand-500)] border-y border-r border-transparent
  rounded-xl p-3
```

**关键变化：**
- 选中态从"全色填充 + 阴影"改为"左边框 + 浅色背景"，更轻量更现代
- 移除选中态的 `shadow-md shadow-emerald-500/20`
- 统一使用品牌色变量 `var(--color-brand-*)` 而非硬编码 `emerald-*`

### 面板阴影精简

| 元素 | 当前 | 改为 |
|------|------|------|
| 列表面板 | `shadow-xl shadow-slate-900/8` | `shadow-sm` |
| 详情面板 | `shadow-xl shadow-slate-900/8` | `shadow-sm` |
| 胶囊 | `shadow-lg shadow-slate-900/8` | `shadow-sm` |
| 列表项选中态 | `shadow-md shadow-emerald-500/20` | 无阴影 |
| StoriesView 详情卡片 | `shadow-sm` | 无阴影（已在面板内） |

### StoriesView 重构

**列表项**：统一为标准列表项设计（图标 + 标题 + 副标题），与其他视图一致

**详情区域**：移除外层 `rounded-3xl border shadow` 卡片包裹，直接在面板内展示内容：
- 元信息区（标题、副标题、分类、日期、封面）→ 简洁的表单布局
- 工具栏 → 优化按钮尺寸和间距
- 编辑器/预览区 → 占满剩余空间

**空状态**：移除虚线边框，使用与其他页面一致的空状态设计

## 三、具体实施步骤

### Step 1：精简 ListDetailLayout 阴影
**文件：** `ListDetailLayout.vue`
- 列表面板：`shadow-xl shadow-slate-900/8 dark:shadow-black/30` → `shadow-sm`
- 详情面板：同上 → `shadow-sm`
- 胶囊：`shadow-lg shadow-slate-900/8 dark:shadow-black/20` → `shadow-sm`

### Step 2：重构列表项设计 — 统一所有视图
**涉及文件：** 所有 9 个使用 ListDetailLayout 的视图 + ModerationView

**统一规范：**
- 基础类：`p-3 rounded-xl border cursor-pointer transition-all duration-200`
- 未选中：`bg-white dark:bg-slate-800/50 border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/80`
- 选中：`bg-[var(--color-brand-50)] dark:bg-[var(--color-brand-500)]/10 border-l-[3px] border-l-[var(--color-brand-500)] border-y border-r border-transparent`
- 标题：`font-medium text-sm truncate`
- 副标题：`text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5`
- 列表间距：`space-y-1.5`
- 移除所有选中态阴影

**ModerationView 特殊处理**：保持 amber 色系但同样改为左边框选中态

### Step 3：重构 StoriesView
**文件：** `StoriesView.vue`

1. **列表项**：改为标准设计（FileText 图标 + 标题 + 分类副标题）
2. **详情区域**：移除 `rounded-3xl border shadow` 外层卡片，直接在面板内布局
3. **空状态**：移除虚线边框，使用 ListDetailLayout 默认空状态（删除 `#empty-detail` slot）
4. **工具栏**：优化按钮间距，移动端增大触摸区域

### Step 4：构建验证
- `vite build`
- `vue-tsc --noEmit`

## 四、修改文件清单

| 文件 | 修改内容 |
|------|---------|
| `components/ui/ListDetailLayout.vue` | 精简阴影 |
| `views/admin/ProjectsView.vue` | 列表项重设计 |
| `views/admin/UsersView.vue` | 列表项重设计 |
| `views/admin/SubmissionsView.vue` | 列表项重设计 |
| `views/admin/DevelopersView.vue` | 列表项重设计 |
| `views/admin/MediaView.vue` | 列表项重设计 |
| `views/admin/AuditView.vue` | 列表项重设计 |
| `views/admin/AdminClaimsView.vue` | 列表项重设计 |
| `views/admin/AdminOrganizationsView.vue` | 列表项重设计 |
| `views/admin/StoriesView.vue` | 列表项重设计 + 详情重构 |
| `views/admin/ModerationView.vue` | 列表项重设计 |
