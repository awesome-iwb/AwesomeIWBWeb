# 后台布局滚动修复 + 澎湃设计语言升级 Spec

## Why
当前后台管理系统存在严重的滚动问题：内容区域滑不下去或一滑到底、侧边栏随页面整页滚动而非固定定位。同时界面设计缺乏现代感，需要参考小米澎湃 OS 3 的设计语言（大圆角、毛玻璃、层次感、流畅动效）进行全面视觉升级，让开发者后台和运维后台都清晰直观。

## What Changes
- **修复侧边栏定位**：将 `h-screen sticky top-0` 改为 `h-full shrink-0`，使侧边栏作为 flex 子项固定在视口内，不再随内容滚动
- **统一滚动策略**：确立"外壳不滚、内容区独立滚"的单一滚动容器原则，消除嵌套滚动冲突
- **修复 router-view 高度问题**：移除 `min-h-full`，改为让子视图通过 `h-full` 自适应父容器
- **修复 ListDetailLayout 滚动**：确保列表面板和详情面板在桌面端各自独立滚动，在移动端堆叠时也能正常滚动
- **移除硬编码 max-height**：将 `max-h-[70vh] lg:max-h-[600px]` 等固定高度改为弹性布局自适应
- **补充移动端底部导航**：在 AdminShell 中集成 BottomNav，解决移动端无导航问题
- **澎湃 OS 3 设计语言升级**：全局引入更大圆角（rounded-2xl/3xl）、毛玻璃效果（backdrop-blur-xl）、层次阴影、流畅过渡动画
- **清理死代码**：移除未使用的 AdminSidebar、DevSidebar、AdminBottomNav、DevBottomNav 组件

## Impact
- Affected code:
  - `frontend/src/components/ui/AdminShell.vue` — 核心布局重构
  - `frontend/src/components/ui/Sidebar.vue` — 定位修复 + 视觉升级
  - `frontend/src/components/ui/ListDetailLayout.vue` — 滚动修复 + 视觉升级
  - `frontend/src/components/ui/BackHeader.vue` — 视觉升级
  - `frontend/src/components/ui/BottomNav.vue` — 集成到 AdminShell
  - `frontend/src/components/ui/design-tokens.css` — 新增澎湃设计变量
  - `frontend/src/views/admin/*.vue` — 移除硬编码高度，适配新布局
  - `frontend/src/views/dev/*.vue` — 同上
- Affected specs: modernize-admin-user-management, add-developer-management-and-project-selectors（UI 层面兼容，无 breaking change）
- 删除文件：
  - `frontend/src/components/admin/AdminSidebar.vue`
  - `frontend/src/components/admin/AdminBottomNav.vue`
  - `frontend/src/components/dev/DevSidebar.vue`
  - `frontend/src/components/dev/DevBottomNav.vue`

## ADDED Requirements

### Requirement: 侧边栏固定定位
系统 SHALL 确保桌面端侧边栏始终固定在视口左侧，不随内容区域滚动。

#### Scenario: 内容区域滚动时侧边栏不动
- **WHEN** 用户在内容区域向下滚动
- **THEN** 侧边栏保持在视口左侧固定位置，导航项和用户信息始终可见

#### Scenario: 侧边栏内容溢出时独立滚动
- **WHEN** 侧边栏导航项过多超出视口高度
- **THEN** 侧边栏内部可独立滚动，不影响内容区域

#### Scenario: 侧边栏折叠/展开
- **WHEN** 用户点击折叠按钮
- **THEN** 侧边栏从 w-60 平滑过渡到 w-16（仅图标模式），内容区域自动扩展

### Requirement: 统一滚动容器策略
系统 SHALL 采用"外壳不滚、内容区独立滚"的单一滚动容器原则。

#### Scenario: 桌面端 ListDetailLayout 视图
- **WHEN** 用户在项目管理、用户权限等使用 ListDetailLayout 的页面
- **THEN** 列表面板和详情面板各自独立滚动，互不影响
- **AND** 侧边栏和顶部栏保持固定

#### Scenario: 桌面端流式布局视图（Dashboard、Analytics）
- **WHEN** 用户在总览、数据分析等流式布局页面
- **THEN** 内容区域整体滚动，侧边栏和顶部栏保持固定

#### Scenario: 移动端视图
- **WHEN** 用户在移动端访问后台
- **THEN** 内容区域可正常滚动，底部导航固定在视口底部
- **AND** 内容不被底部导航遮挡

### Requirement: 移除硬编码高度限制
系统 SHALL 不再使用硬编码的 `max-height` 值限制内容区域高度。

#### Scenario: 详情面板内容较多
- **WHEN** 项目详情或用户详情的内容超出视口高度
- **THEN** 详情面板内部可滚动查看全部内容，不会被截断

#### Scenario: 列表面板选项较多
- **WHEN** 列表中的选项超出可视区域
- **THEN** 列表面板可独立滚动查看全部选项

### Requirement: 移动端底部导航集成
系统 SHALL 在 AdminShell 中集成 BottomNav 组件，为移动端提供导航能力。

#### Scenario: 移动端显示底部导航
- **WHEN** 用户在移动端（< lg 断点）访问后台
- **THEN** 底部显示固定导航栏，包含主要导航项和"更多"按钮
- **AND** 内容区域底部留出足够 padding 避免被导航栏遮挡

#### Scenario: 移动端"更多"菜单
- **WHEN** 用户点击底部导航的"更多"按钮
- **THEN** 从底部滑出 Sheet 面板，包含次要导航项、用户信息和退出登录

### Requirement: 澎湃 OS 3 设计语言
系统 SHALL 在后台管理界面中应用澎湃 OS 3 风格的设计元素。

#### Scenario: 圆角系统
- **WHEN** 渲染卡片、面板、按钮等 UI 元素
- **THEN** 使用统一的圆角规范：小组件 rounded-xl（12px），卡片 rounded-2xl（16px），大面板 rounded-3xl（24px）
- **AND** 侧边栏导航项使用 rounded-xl

#### Scenario: 毛玻璃效果
- **WHEN** 渲染侧边栏、顶部栏、底部导航、弹出面板
- **THEN** 使用 `backdrop-blur-xl`（24px 模糊）+ 半透明背景实现毛玻璃效果
- **AND** 侧边栏背景 `bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl`
- **AND** 顶部栏背景 `bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl`
- **AND** 底部导航背景 `bg-white/80 dark:bg-slate-900/75 backdrop-blur-xl`

#### Scenario: 层次阴影
- **WHEN** 渲染悬浮卡片和弹出面板
- **THEN** 使用多层阴影营造深度感：`shadow-xl shadow-slate-900/8 dark:shadow-black/30`
- **AND** 选中态导航项使用品牌色阴影：`shadow-md shadow-[var(--color-brand-shadow)]`

#### Scenario: 流畅过渡动画
- **WHEN** 侧边栏折叠/展开、视图切换、面板弹出
- **THEN** 使用 `transition-all duration-300 ease-out` 实现流畅过渡
- **AND** 移动端详情面板使用 `transition-transform duration-300 ease-out` 滑入滑出

#### Scenario: 品牌色渐变
- **WHEN** 渲染侧边栏 Logo 区域
- **THEN** 使用品牌色渐变文字：`bg-gradient-to-r from-[var(--color-brand-gradient-from)] to-[var(--color-brand-gradient-to)] bg-clip-text text-transparent`

### Requirement: 清理死代码
系统 SHALL 移除所有未使用的旧版侧边栏和底部导航组件。

#### Scenario: 移除旧组件
- **WHEN** 执行代码清理
- **THEN** 删除 `components/admin/AdminSidebar.vue`、`components/admin/AdminBottomNav.vue`、`components/dev/DevSidebar.vue`、`components/dev/DevBottomNav.vue`
- **AND** 确认这些组件未被任何文件引用

## MODIFIED Requirements

### Requirement: AdminShell 布局结构
原布局使用 `h-screen flex overflow-hidden`，侧边栏使用 `h-screen sticky top-0`，router-view 使用 `min-h-full`。修改为：
- 外壳：`h-dvh flex overflow-hidden`（使用 `dvh` 适配移动端视口高度）
- 侧边栏：`h-full shrink-0`（作为 flex 子项固定，移除 `sticky`）
- 右侧区域：`flex-1 flex flex-col min-h-0 overflow-hidden`
- main：`flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 lg:p-6`（移除 `overscroll-contain`）
- router-view：移除 `min-h-full`，改为让子视图自行控制高度
- 新增：移动端 BottomNav 集成，main 在移动端添加 `pb-20` 底部留白

### Requirement: Sidebar 组件
原侧边栏使用 `h-screen sticky top-0`。修改为：
- 使用 `h-full shrink-0` 替代 `h-screen sticky top-0`
- 导航区域使用 `overflow-y-auto` 处理溢出
- 品牌名使用渐变文字
- 导航项圆角从 `rounded-xl` 保持不变
- 新增导航项 hover 时的微妙缩放效果 `active:scale-[0.98]`

### Requirement: ListDetailLayout 组件
原组件在移动端使用 `max-h-[42vh]` 限制列表高度，详情面板无独立滚动。修改为：
- 桌面端：列表和详情面板各自 `overflow-y-auto`，高度由 flex 布局自动分配
- 移动端：列表和详情堆叠，列表使用 `max-h-[40vh]`，详情使用 `flex-1 min-h-0 overflow-y-auto`
- 移除所有硬编码 `max-height` 内联样式
- 面板圆角统一为 `rounded-2xl`

### Requirement: BackHeader 组件
原顶部栏样式简单。修改为：
- 添加毛玻璃效果 `backdrop-blur-xl`
- 半透明背景 `bg-white/70 dark:bg-slate-900/60`
- 底部边框使用半透明白色 `border-white/70 dark:border-slate-700/70`

### Requirement: design-tokens.css
原设计变量缺少澎湃风格相关定义。修改为新增：
- `--radius-2xl: 1rem`（16px）
- `--radius-3xl: 1.5rem`（24px）
- `--blur-glass: 24px`（毛玻璃模糊度）
- `--shadow-layer-1`、`--shadow-layer-2`、`--shadow-layer-3`（三层阴影系统）

## REMOVED Requirements

### Requirement: AdminSidebar / DevSidebar 独立侧边栏组件
**Reason**: 已被 `ui/Sidebar.vue` 统一替代，AdminSidebar 和 DevSidebar 是死代码，未被任何文件引用。
**Migration**: 直接删除，无需迁移。

### Requirement: AdminBottomNav / DevBottomNav 独立底部导航组件
**Reason**: 已被 `ui/BottomNav.vue` 统一替代，且当前 AdminShell 未集成任何底部导航。将在 AdminShell 中集成 BottomNav。
**Migration**: 删除旧组件，在 AdminShell 中新增 BottomNav 集成。
