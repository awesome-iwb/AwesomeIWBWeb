# 运维后台与开发者后台移动端/桌面端体验全面优化 Spec

## Why

当前运维后台和开发者后台虽然已完成基础布局修复和澎湃设计语言升级，但在实际使用中存在大量影响操作效率的 UI/UX 问题：

1. **手机端编辑体验极差**：表单字段密集堆叠，输入框过小，按钮难以点击，模态框在窄屏上显示不全
2. **列表交互不友好**：列表项选中态仅依赖左侧边框线，视觉反馈弱；列表项点击区域不明确；移动端列表和详情的切换逻辑混乱
3. **卡片设计缺乏层次感**：卡片阴影、圆角、间距不统一，信息层级不清晰
4. **表单组件未针对移动端优化**：输入框、选择器、搜索组件在手机上字体过小、触控区域不足
5. **底部导航和顶部栏占用过多空间**：移动端有效内容区域被严重挤压
6. **缺乏 G2 连续圆角**：当前圆角为简单的 CSS `border-radius`，缺少澎湃 OS 3 标志性的连续曲率圆角（G2 Continuous Curvature）

本次优化将参考澎湃 OS 3 的设计语言，引入 G2 连续圆角概念，对后台进行从组件到页面的全面体验升级。

## What Changes

- **引入 G2 连续圆角系统**：用 CSS `clip-path` + `border-radius` 组合实现近似 G2 连续圆角的视觉效果，替代简单圆角
- **全面重构表单组件**：增大触控区域、优化字体层级、适配移动端键盘弹出场景
- **列表体验升级**：重新设计列表项选中态、悬停态、点击反馈；优化移动端列表-详情切换流程
- **卡片视觉层次重构**：统一阴影系统、间距系统、信息层级
- **移动端布局优化**：优化底部导航、顶部栏高度；增加安全区域适配；优化键盘弹出时的布局行为
- **新增移动端专用交互组件**：SwipeAction（滑动操作）、ActionSheet（操作菜单）、ContextMenu（上下文菜单）
- **优化模态框/弹窗在移动端的显示**：全屏模态、底部 Sheet、居中弹窗三种模式自适应
- **优化空状态、加载状态、错误状态的视觉表现**

## Impact

- Affected code:
  - `frontend/src/components/ui/design-tokens.css` — 新增 G2 圆角变量、间距系统、触控规范
  - `frontend/src/components/ui/Card.vue` — 重构卡片视觉
  - `frontend/src/components/ui/ListItem.vue` — 重构列表项交互
  - `frontend/src/components/ui/FormInput.vue` — 移动端适配
  - `frontend/src/components/ui/Modal.vue` — 移动端自适应
  - `frontend/src/components/ui/BottomSheet.vue` — 增强交互
  - `frontend/src/components/ui/BottomNav.vue` — 优化移动端显示
  - `frontend/src/components/ui/BackHeader.vue` — 优化高度和布局
  - `frontend/src/components/ui/AdminShell.vue` — 优化移动端布局
  - `frontend/src/components/ui/ListDetailLayout.vue` — 重构列表-详情交互
  - `frontend/src/components/admin/DashboardCard.vue` — 适配新设计
  - `frontend/src/components/admin/CapabilityEditor.vue` — 移动端适配
  - `frontend/src/components/admin/SearchSelect.vue` — 移动端适配
  - `frontend/src/views/admin/*.vue` — 全面适配
  - `frontend/src/views/dev/*.vue` — 全面适配
- Affected specs: fix-admin-layout-scroll-and-hyperos-design（在其基础上增强，无 breaking change）

## ADDED Requirements

### Requirement: G2 连续圆角系统

系统 SHALL 引入 G2 连续圆角（G2 Continuous Curvature）设计概念，让圆角过渡更加自然流畅。

#### Scenario: 卡片圆角
- **WHEN** 渲染卡片组件
- **THEN** 使用 G2 连续圆角效果，圆角大小根据卡片尺寸自适应
- **AND** 小卡片（如列表项）使用 `--radius-sm-g2: 10px`
- **AND** 中卡片（如信息面板）使用 `--radius-md-g2: 16px`
- **AND** 大卡片（如模态框）使用 `--radius-lg-g2: 24px`

#### Scenario: 按钮圆角
- **WHEN** 渲染按钮组件
- **THEN** 小按钮使用 `--radius-sm-g2: 10px`
- **AND** 大按钮/CTA 使用 `--radius-md-g2: 14px`
- **AND** 图标按钮保持圆形 `--radius-full`

#### Scenario: 输入框圆角
- **WHEN** 渲染输入框、选择器
- **THEN** 统一使用 `--radius-sm-g2: 12px`
- **AND** 聚焦时圆角保持不变，仅边框颜色变化

### Requirement: 移动端表单优化

系统 SHALL 针对移动端优化所有表单输入体验。

#### Scenario: 输入框触控区域
- **WHEN** 用户在手机上点击输入框
- **THEN** 输入框最小高度为 48px（触控规范）
- **AND** 输入框内边距充足，文字不贴边
- **AND** 占位文字（placeholder）字号不小于 14px

#### Scenario: 选择器触控区域
- **WHEN** 用户在手机上操作选择器
- **THEN** 选择器最小高度为 48px
- **AND** 下拉选项最小高度为 44px
- **AND** 选项文字不小于 14px

#### Scenario: 按钮触控区域
- **WHEN** 用户在手机上点击按钮
- **THEN** 按钮最小触控区域为 44x44px
- **AND** 主要操作按钮高度不小于 48px
- **AND** 按钮间距不小于 8px，避免误触

#### Scenario: 表单分组与间距
- **WHEN** 渲染表单页面
- **THEN** 相关字段分组显示，组间距 24px
- **AND** 组内字段间距 16px
- **AND** 标签与输入框间距 8px

### Requirement: 列表体验升级

系统 SHALL 重新设计列表组件的交互和视觉表现。

#### Scenario: 列表项选中态
- **WHEN** 用户选中列表项
- **THEN** 列表项背景色变为品牌色浅色（`--color-brand-50`）
- **AND** 左侧显示品牌色竖线指示器（宽度 3px，圆角）
- **AND** 列表项整体有微妙的阴影提升
- **AND** 文字颜色变为品牌色深色

#### Scenario: 列表项悬停态（桌面端）
- **WHEN** 鼠标悬停在列表项上
- **THEN** 背景色变为 `--color-bg-hover`
- **AND** 有微妙的缩放效果 `scale-[1.01]`
- **AND** 过渡动画流畅 200ms

#### Scenario: 列表项点击反馈（移动端）
- **WHEN** 用户点击列表项
- **THEN** 立即有按压反馈（背景色加深）
- **AND** 释放后恢复，过渡 150ms

#### Scenario: 移动端列表-详情切换
- **WHEN** 用户在手机上从列表进入详情
- **THEN** 列表隐藏，详情全屏显示
- **AND** 顶部显示返回按钮和当前项标题
- **AND** 返回时恢复列表视图，保持滚动位置

### Requirement: 卡片视觉层次重构

系统 SHALL 统一卡片的视觉层次系统。

#### Scenario: 卡片阴影层级
- **WHEN** 渲染不同重要程度的卡片
- **THEN** 使用三层阴影系统：
  - 第一层（默认卡片）：`shadow-sm` — 轻微提升
  - 第二层（交互卡片）：`shadow-md` — 明显悬浮
  - 第三层（模态/浮层）：`shadow-xl` — 强烈悬浮

#### Scenario: 卡片间距系统
- **WHEN** 渲染卡片内容
- **THEN** 卡片内边距统一为：
  - 移动端：`p-4`（16px）
  - 桌面端：`p-5`（20px）或 `p-6`（24px）
- **AND** 卡片间距统一为 `gap-4`（16px）

#### Scenario: 卡片信息层级
- **WHEN** 卡片内有多层信息
- **THEN** 使用字体大小和颜色区分层级：
  - 主标题：`text-base font-bold text-primary`
  - 副标题：`text-sm font-medium text-secondary`
  - 描述：`text-sm text-tertiary`
  - 辅助信息：`text-xs text-tertiary`

### Requirement: 移动端布局优化

系统 SHALL 优化移动端整体布局，提升内容展示效率。

#### Scenario: 顶部栏优化
- **WHEN** 在移动端显示顶部栏
- **THEN** 高度压缩至 48px
- **AND** 标题文字居中显示
- **AND** 操作按钮精简为图标按钮

#### Scenario: 底部导航优化
- **WHEN** 在移动端显示底部导航
- **THEN** 高度为 56px + safe-area-inset-bottom
- **AND** 图标尺寸 24px，文字 10px
- **AND** 选中项有品牌色指示器（顶部小横线或背景色）
- **AND** 背景使用毛玻璃效果

#### Scenario: 安全区域适配
- **WHEN** 在 iPhone 等带刘海/圆角设备上显示
- **THEN** 顶部内容不被刘海遮挡
- **AND** 底部内容不被 Home Indicator 遮挡
- **AND** 使用 `env(safe-area-inset-*)` 适配

#### Scenario: 键盘弹出适配
- **WHEN** 用户聚焦输入框，软键盘弹出
- **THEN** 页面内容自动上移，输入框不被键盘遮挡
- **AND** 底部固定元素（如底部导航）随键盘弹出隐藏

### Requirement: 模态框移动端自适应

系统 SHALL 让模态框根据屏幕尺寸自动选择最佳显示模式。

#### Scenario: 手机端模态框
- **WHEN** 屏幕宽度 < 640px
- **THEN** 模态框从底部滑出（Sheet 模式）
- **AND** 占据屏幕 85% 高度
- **AND** 顶部有拖拽指示条
- **AND** 点击遮罩或下滑可关闭

#### Scenario: 平板端模态框
- **WHEN** 屏幕宽度 640px - 1024px
- **THEN** 模态框居中显示
- **AND** 最大宽度 500px
- **AND** 圆角 24px

#### Scenario: 桌面端模态框
- **WHEN** 屏幕宽度 >= 1024px
- **THEN** 模态框居中显示
- **AND** 最大宽度根据内容自适应（sm/md/lg）
- **AND** 圆角 20px

### Requirement: 空状态与加载状态优化

系统 SHALL 优化各种状态的视觉表现。

#### Scenario: 空状态
- **WHEN** 列表或页面无数据
- **THEN** 显示空状态插图（图标 + 文字）
- **AND** 图标使用品牌色，尺寸 48px
- **AND** 标题 `text-base font-bold`，描述 `text-sm text-secondary`
- **AND** 如有必要，显示操作按钮引导用户

#### Scenario: 加载状态
- **WHEN** 数据加载中
- **THEN** 显示加载动画（品牌色旋转圆环）
- **AND** 加载动画尺寸 24px
- **AND** 骨架屏优先于旋转动画（内容区域较大时）

#### Scenario: 错误状态
- **WHEN** 数据加载失败
- **THEN** 显示错误提示（图标 + 文字 + 重试按钮）
- **AND** 使用红色系提示
- **AND** 提供明确的重试操作

## MODIFIED Requirements

### Requirement: Card 组件

原 Card 组件使用简单圆角和固定阴影。修改为：
- 使用 G2 连续圆角 `--radius-md-g2`（16px）作为默认圆角
- 新增 `compact` 变体用于移动端，内边距 `p-4`
- 阴影根据 `variant` 自动选择层级
- 新增 `hoverable` 属性，开启时桌面端悬停有提升效果

### Requirement: ListItem 组件

原 ListItem 使用简单边框和背景色区分状态。修改为：
- 选中态：左侧品牌色竖线 + 品牌色浅色背景 + 微妙阴影
- 悬停态（桌面端）：背景色变化 + 微缩放
- 点击态（移动端）：按压反馈
- 圆角统一为 `--radius-sm-g2`（10px）
- 内边距移动端 `p-3`，桌面端 `p-3.5`

### Requirement: FormInput 组件

原 FormInput 未针对移动端优化。修改为：
- 最小高度 48px（移动端）/ 40px（桌面端）
- 字体大小 16px（移动端防止缩放）/ 14px（桌面端）
- 内边距充足 `px-4 py-3`
- 聚焦时边框颜色变化 + 微妙阴影
- 错误状态时显示红色边框和错误提示

### Requirement: Modal 组件

原 Modal 使用固定居中布局。修改为：
- 移动端（< 640px）：底部 Sheet 模式
- 平板端（640px - 1024px）：居中，最大宽度 500px
- 桌面端（>= 1024px）：居中，自适应宽度
- 圆角根据模式自适应
- 新增 `mode` 属性可强制指定显示模式

### Requirement: BottomNav 组件

原 BottomNav 高度固定，选中态简单。修改为：
- 高度 56px + safe-area-inset-bottom
- 选中项显示品牌色顶部指示条（2px）
- 背景毛玻璃效果增强
- 图标和文字间距优化
- 点击反馈更明显

### Requirement: BackHeader 组件

原 BackHeader 高度和布局未针对移动端优化。修改为：
- 移动端高度 48px，桌面端 52px
- 标题在移动端居中，桌面端左对齐
- 返回按钮触控区域 44x44px
- 操作按钮在移动端精简为图标

### Requirement: AdminShell 组件

原 AdminShell 移动端布局有优化空间。修改为：
- main 区域在移动端 `pt-2 pb-20 px-3`
- 桌面端 `pt-4 pb-6 px-6`
- 优化键盘弹出时的布局行为
- 安全区域适配

### Requirement: ListDetailLayout 组件

原 ListDetailLayout 移动端列表-详情切换体验不佳。修改为：
- 移动端列表项更大，触控更友好
- 详情页进入时有滑入动画
- 返回时有滑出动画
- 保持滚动位置
- 列表空状态优化

## REMOVED Requirements

无需要移除的功能。
