# Tasks

- [x] Task 1: 设计令牌系统升级 — 在 design-tokens.css 中新增 G2 连续圆角、间距系统、触控规范变量
  - [x] SubTask 1.1: 新增 G2 连续圆角变量：`--radius-sm-g2`、`--radius-md-g2`、`--radius-lg-g2`
  - [x] SubTask 1.2: 新增间距系统变量：`--space-xs` 到 `--space-2xl`
  - [x] SubTask 1.3: 新增触控规范变量：`--touch-min-height`、`--touch-min-width`
  - [x] SubTask 1.4: 新增背景悬停色变量：`--color-bg-hover`
  - [x] SubTask 1.5: 新增字体层级变量：`--font-size-mobile-base`、`--font-size-desktop-base`

- [x] Task 2: Card 组件重构 — 升级卡片视觉层次和圆角系统
  - [x] SubTask 2.1: 将圆角替换为 G2 连续圆角变量
  - [x] SubTask 2.2: 新增 `compact` 变体（移动端专用，内边距 p-4）
  - [x] SubTask 2.3: 新增 `hoverable` 属性，桌面端悬停有提升效果
  - [x] SubTask 2.4: 优化阴影层级，根据 variant 自动选择
  - [x] SubTask 2.5: 统一信息层级样式（标题、副标题、描述）

- [x] Task 3: ListItem 组件重构 — 升级列表项交互和视觉
  - [x] SubTask 3.1: 重新设计选中态（品牌色竖线 + 浅色背景 + 阴影）
  - [x] SubTask 3.2: 新增悬停态（桌面端背景变化 + 微缩放）
  - [x] SubTask 3.3: 新增点击反馈（移动端按压效果）
  - [x] SubTask 3.4: 圆角统一为 `--radius-sm-g2`
  - [x] SubTask 3.5: 优化内边距（移动端 p-3，桌面端 p-3.5）

- [x] Task 4: FormInput 组件移动端适配 — 优化表单输入体验
  - [x] SubTask 4.1: 移动端最小高度 48px，桌面端 40px
  - [x] SubTask 4.2: 移动端字体 16px 防止缩放，桌面端 14px
  - [x] SubTask 4.3: 优化内边距 px-4 py-3
  - [x] SubTask 4.4: 聚焦时添加微妙阴影效果
  - [x] SubTask 4.5: 错误状态样式优化

- [x] Task 5: Modal 组件移动端自适应 — 实现三种显示模式
  - [x] SubTask 5.1: 移动端（< 640px）底部 Sheet 模式
  - [x] SubTask 5.2: 平板端（640px - 1024px）居中模式
  - [x] SubTask 5.3: 桌面端（>= 1024px）居中自适应模式
  - [x] SubTask 5.4: 新增 `mode` 属性可强制指定显示模式
  - [x] SubTask 5.5: 圆角根据模式自适应
  - [x] SubTask 5.6: 移动端支持下滑关闭

- [x] Task 6: BottomNav 组件优化 — 提升移动端导航体验
  - [x] SubTask 6.1: 高度调整为 56px + safe-area-inset-bottom
  - [x] SubTask 6.2: 选中项添加品牌色顶部指示条（2px）
  - [x] SubTask 6.3: 增强毛玻璃背景效果
  - [x] SubTask 6.4: 优化图标和文字间距
  - [x] SubTask 6.5: 添加点击反馈动画

- [x] Task 7: BackHeader 组件优化 — 压缩移动端顶部栏
  - [x] SubTask 7.1: 移动端高度 48px，桌面端 52px
  - [x] SubTask 7.2: 移动端标题居中，桌面端左对齐
  - [x] SubTask 7.3: 返回按钮触控区域 44x44px
  - [x] SubTask 7.4: 移动端操作按钮精简为图标

- [x] Task 8: AdminShell 布局优化 — 移动端布局微调
  - [x] SubTask 8.1: 移动端 main 区域 pt-2 pb-20 px-3
  - [x] SubTask 8.2: 桌面端 main 区域 pt-4 pb-6 lg:px-6
  - [x] SubTask 8.3: 添加键盘弹出时的布局处理
  - [x] SubTask 8.4: 安全区域适配

- [x] Task 9: ListDetailLayout 交互升级 — 优化列表-详情切换体验
  - [x] SubTask 9.1: 移动端列表项增大触控区域
  - [x] SubTask 9.2: 详情页进入滑入动画
  - [x] SubTask 9.3: 返回时滑出动画
  - [x] SubTask 9.4: 保持列表滚动位置
  - [x] SubTask 9.5: 优化空状态显示

- [x] Task 10: 新增移动端交互组件
  - [x] SubTask 10.1: 创建 ActionSheet 组件（底部操作菜单）
  - [x] SubTask 10.2: 创建 SwipeAction 组件（列表项滑动操作）
  - [x] SubTask 10.3: 在 ui/index.ts 中导出新组件

- [x] Task 11: 视图页面全面适配 — 所有 admin/dev 视图适配新设计
  - [x] SubTask 11.1: DashboardView.vue 卡片和统计适配
  - [x] SubTask 11.2: UsersView.vue 表单和列表适配
  - [x] SubTask 11.3: ProjectsView.vue 表单和列表适配
  - [x] SubTask 11.4: SubmissionsView.vue 审核界面适配
  - [x] SubTask 11.5: ReviewView.vue 标签页适配
  - [x] SubTask 11.6: DevDashboardView.vue 开发者总览适配
  - [x] SubTask 11.7: DevProjectsView.vue 开发者项目适配
  - [x] SubTask 11.8: 其他视图（MediaView, AuditView, AnalyticsView 等）适配

- [x] Task 12: CapabilityEditor 移动端适配
  - [x] SubTask 12.1: 权限分组折叠面板优化触控区域
  - [x] SubTask 12.2: 复选框增大触控区域
  - [x] SubTask 12.3: 模板选择器优化

- [x] Task 13: SearchSelect 移动端适配
  - [x] SubTask 13.1: 下拉选项最小高度 44px
  - [x] SubTask 13.2: 搜索框移动端高度 48px
  - [x] SubTask 13.3: 结果列表触控优化

- [x] Task 14: 空状态与加载状态组件优化
  - [x] SubTask 14.1: EmptyState 组件视觉升级
  - [x] SubTask 14.2: LoadingSpinner 组件优化
  - [x] SubTask 14.3: 新增 ErrorState 错误状态组件

- [x] Task 15: 构建验证
  - [x] SubTask 15.1: 运行 vite build 确保无编译错误
  - [x] SubTask 15.2: 运行 TypeScript 类型检查
  - [x] SubTask 15.3: 在浏览器中验证移动端和桌面端效果

# Task Dependencies
- Task 1 是基础设施，其他任务依赖它
- Task 2-9 是组件层优化，可并行执行
- Task 10 是新增组件，可与其他组件任务并行
- Task 11-13 是视图层适配，依赖 Task 2-9 完成
- Task 14 是状态组件优化，可与其他任务并行
- Task 15 依赖所有其他任务完成
