# Tasks

- [x] Task 1: 修复 Sidebar 定位 — 将 `h-screen sticky top-0` 改为 `h-full shrink-0`，确保侧边栏作为 flex 子项固定
  - [x] SubTask 1.1: 修改 `Sidebar.vue`，将 `h-screen sticky top-0` 替换为 `h-full shrink-0`
  - [x] SubTask 1.2: 确认导航区域 `overflow-y-auto` 正常工作
  - [x] SubTask 1.3: 验证折叠/展开功能不受影响

- [x] Task 2: 修复 AdminShell 核心布局 — 统一滚动容器策略，集成移动端导航
  - [x] SubTask 2.1: 将外壳 `h-screen` 改为 `h-dvh` 适配移动端
  - [x] SubTask 2.2: 移除 `<router-view>` 上的 `min-h-full` class
  - [x] SubTask 2.3: 移除 `<main>` 上的 `overscroll-contain`
  - [x] SubTask 2.4: 在 AdminShell 中集成 BottomNav 组件（移动端显示）
  - [x] SubTask 2.5: 为 `<main>` 添加移动端底部留白 `pb-20 lg:pb-6`
  - [x] SubTask 2.6: 将 sidebarItems 分为 primaryItems 和 secondaryItems 传递给 BottomNav

- [x] Task 3: 修复 ListDetailLayout 滚动 — 确保双栏各自独立滚动
  - [x] SubTask 3.1: 桌面端确保列表和详情面板使用 `flex-1 min-h-0 overflow-y-auto` 各自独立滚动
  - [x] SubTask 3.2: 移动端列表使用 `max-h-[40vh]`，详情使用 `flex-1 min-h-0 overflow-y-auto`
  - [x] SubTask 3.3: 确保根容器 `h-full min-h-0` 正确传递高度

- [x] Task 4: 移除视图中的硬编码高度 — 修复各 admin/dev 视图的 max-height 问题
  - [x] SubTask 4.1: 检查并修复 `UsersView.vue` 中的 `max-h-[70vh] lg:max-h-[600px]`
  - [x] SubTask 4.2: 检查并修复 `ProjectsView.vue` 中的固定高度限制
  - [x] SubTask 4.3: 检查并修复 `StoriesView.vue` 中的编辑器高度问题
  - [x] SubTask 4.4: 检查并修复 `AnalyticsView.vue` 缺少 `h-full` 的问题
  - [x] SubTask 4.5: 检查其他 admin/dev 视图是否有类似问题

- [x] Task 5: 澎湃 OS 3 设计语言升级 — 更新 design-tokens.css 和组件样式
  - [x] SubTask 5.1: 在 `design-tokens.css` 中新增 `--radius-2xl`、`--radius-3xl`、`--blur-glass`、三层阴影变量
  - [x] SubTask 5.2: 升级 `Sidebar.vue` 样式：品牌名渐变、毛玻璃背景、导航项微动效
  - [x] SubTask 5.3: 升级 `BackHeader.vue` 样式：毛玻璃效果、半透明背景
  - [x] SubTask 5.4: 升级 `ListDetailLayout.vue` 样式：统一圆角 rounded-2xl、毛玻璃卡片
  - [x] SubTask 5.5: 升级 `BottomNav.vue` 样式：确认毛玻璃效果和圆角

- [x] Task 6: 清理死代码 — 删除未使用的旧组件
  - [x] SubTask 6.1: 删除 `components/admin/AdminSidebar.vue`
  - [x] SubTask 6.2: 删除 `components/admin/AdminBottomNav.vue`
  - [x] SubTask 6.3: 删除 `components/dev/DevSidebar.vue`
  - [x] SubTask 6.4: 删除 `components/dev/DevBottomNav.vue`
  - [x] SubTask 6.5: 全局搜索确认无其他文件引用这些组件

- [x] Task 7: 构建验证 — 确保所有修改不破坏构建
  - [x] SubTask 7.1: 运行 `vite build` 确保无编译错误
  - [x] SubTask 7.2: 运行 TypeScript 类型检查确保无类型错误

# Task Dependencies
- Task 1 和 Task 2 可并行执行（都修改布局但不同文件）
- Task 3 依赖 Task 2（ListDetailLayout 的滚动修复依赖 AdminShell 的布局修正）
- Task 4 依赖 Task 2 和 Task 3（视图中的硬编码高度移除依赖布局框架修正）
- Task 5 可与 Task 1-4 并行执行（纯样式变更，不影响逻辑）
- Task 6 可在任意时间执行（独立清理工作）
- Task 7 依赖所有其他 Task 完成
