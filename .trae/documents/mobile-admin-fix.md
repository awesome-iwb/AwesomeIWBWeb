# 手机版管理后台修复计划

## 问题诊断

经过对全部 admin/dev 视图和 UI 组件的深入分析，手机版管理后台存在以下核心问题：

### 问题 1：ListDetailLayout 手机端详情页被 BottomNav 遮挡

**根因**：`ListDetailLayout.vue` 第 44 行，手机端详情面板使用 `fixed inset-0 z-30`，但 `BottomNav.vue` 使用 `fixed bottom-0 z-50`。详情面板的底部被 BottomNav 完全遮挡（z-30 < z-50），导致详情内容底部无法交互。

**影响范围**：所有使用 `ui-ListDetailLayout` 的 9 个 admin 视图（Projects, Submissions, Developers, Users, Audit, Media, Organizations, Claims, Stories），手机端选中详情后底部内容被遮挡，无法操作按钮。

### 问题 2：ListDetailLayout 手机端详情页没有底部安全区

详情面板 `fixed inset-0` 没有考虑手机底部安全区（safe area），在 iPhone 等设备上底部内容可能被 Home Indicator 遮挡。

### 问题 3：详情面板的返回按钮不直观

手机端选中详情后，列表被 `hidden`，用户只能通过详情面板左上角的小返回箭头回到列表。但这个返回箭头很小（w-8 h-8），且没有明确的"返回列表"文字提示，用户容易迷失。

### 问题 4：StoriesView 文章编辑器在手机端不可用

文章编辑器的 Markdown 编辑区域使用了 `min-h-[300px]` 的固定高度，在手机端详情面板（已经是 fixed 全屏）内部，textarea 无法正确撑满剩余空间，导致编辑区域极小或无法滚动。工具栏按钮在手机端也过于拥挤。

### 问题 5：ProjectsView 详情表单在手机端溢出

项目编辑表单使用了 `style="max-height: 600px"` 的固定最大高度，在手机端详情面板内无法正确适配，内容可能溢出或无法完整滚动查看。

### 问题 6：UsersView 详情表单同样有 max-height 固定高度问题

用户详情区域也使用了 `style="max-height: 600px"`，手机端体验同上。

### 问题 7：弹窗（Modal）在手机端被详情面板遮挡

ProjectsView 的分类管理、历史版本、审计日志等弹窗使用 `z-50`，但详情面板是 `z-30`。当弹窗在详情面板之上打开时，虽然 z-index 够高，但弹窗的 `fixed inset-0` 可能与详情面板的 `fixed inset-0` 产生交互冲突。

### 问题 8：Dev 后台页面未使用 ListDetailLayout，手机端体验尚可但有改进空间

DevProjectsView 和 DevOrganizationsView 使用卡片网格布局，手机端自动变为单列，基本可用。但分页组件在底部可能被 BottomNav 遮挡。

---

## 修复方案

### 修复 1：ListDetailLayout — 解决 BottomNav 遮挡问题

**方案**：将手机端详情面板的 z-index 从 `z-30` 提升到 `z-40`（低于 BottomNav 的 z-50），同时在详情面板底部添加 `pb-16`（BottomNav 高度为 h-16）的 padding，确保内容不被遮挡。

**文件**：`components/ui/ListDetailLayout.vue`

修改点：
- 手机端详情面板：`z-30` → `z-40`
- 手机端详情面板内容区：添加 `pb-16` 底部 padding
- 手机端返回栏：添加 `pb-safe` 或 `env(safe-area-inset-bottom)` 安全区支持

### 修复 2：ListDetailLayout — 改进手机端返回体验

**方案**：将手机端详情面板顶部的返回按钮区域改进，增加更明显的返回提示，让用户知道如何回到列表。

修改点：
- 返回按钮区域增加半透明背景
- 返回按钮增大点击区域
- 添加"返回列表"文字提示

### 修复 3：AdminShell — 列表面表也需要 pb-16

**方案**：在 `AdminShell.vue` 的 `<main>` 区域，手机端添加 `pb-16`，确保列表页底部内容不被 BottomNav 遮挡。

**文件**：`components/ui/AdminShell.vue`

当前代码：`<main class="flex-1 min-h-0 overflow-hidden p-4 pb-20 lg:p-6 lg:pb-6">`

已有 `pb-20`（80px），BottomNav 是 `h-16`（64px），所以列表页的 padding 已经够了。但详情面板是 fixed 定位的，不受 main 的 padding 影响，所以需要在 ListDetailLayout 内部处理。

### 修复 4：StoriesView — 修复手机端文章编辑器

**方案**：
- 移除 `min-h-[300px]` 和 `max-h-[400px]` 等固定高度
- 让编辑区域使用 `flex-1` 自适应剩余空间
- 工具栏在手机端使用更紧凑的布局
- 编辑/预览切换在手机端只显示"编辑"和"预览"两个选项

**文件**：`views/admin/StoriesView.vue`

### 修复 5：ProjectsView — 移除固定 max-height

**方案**：
- 将 `style="max-height: 600px"` 改为使用 CSS class `max-h-[70vh] lg:max-h-[600px]`
- 手机端使用视口相对高度，桌面端保持 600px

**文件**：`views/admin/ProjectsView.vue`

### 修复 6：UsersView — 移除固定 max-height

**方案**：同 ProjectsView，将 `style="max-height: 600px"` 改为响应式高度。

**文件**：`views/admin/UsersView.vue`

### 修复 7：BottomNav — 添加安全区支持

**方案**：为 BottomNav 添加底部安全区 padding，适配 iPhone 等设备。

**文件**：`components/ui/BottomNav.vue`

修改点：
- 添加 `pb-safe` 或使用 `env(safe-area-inset-bottom)` 的 padding
- 高度从固定 `h-16` 改为 `h-16 + safe-area`

### 修复 8：全局添加 safe-area viewport meta

检查 `index.html` 是否已有 `viewport-fit=cover`，如果没有需要添加，否则 `env(safe-area-inset-bottom)` 不会生效。

**文件**：`index.html`

---

## 实施步骤

1. **修复 ListDetailLayout** — z-index + pb-16 + 安全区 + 返回按钮改进
2. **修复 BottomNav** — 安全区 padding
3. **修复 index.html** — viewport-fit=cover
4. **修复 StoriesView** — 编辑器手机端适配
5. **修复 ProjectsView** — 移除固定 max-height
6. **修复 UsersView** — 移除固定 max-height
7. **验证构建** — vite build 通过
