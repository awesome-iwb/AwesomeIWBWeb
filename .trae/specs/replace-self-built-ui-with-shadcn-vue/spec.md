# 全面替换自建组件为 shadcn-vue 并统一样式 Spec

## Why
项目当前存在严重的 UI 不统一问题：3386 处硬编码 Tailwind 色值 vs 仅 105 处 design token 引用，58 个文件中 370 处原生 HTML 控件未封装，12 个文件中 48 处内联 style 硬编码。shadcn-vue 基础设施已安装完毕（reka-ui、CVA、clsx、tailwind-merge、tw-animate-css、components.json），5 个新组件（Select、Switch、Textarea、Sonner、Tooltip）已创建，现在需要全面替换 19 个自建组件为 shadcn-vue 版本，并统一全站样式为语义化 CSS 变量。

## What Changes
- 新增 shadcn-vue 组件：Button、Input、Dialog、Card、Tabs、Avatar、Badge、Pagination、Label、Separator、Sheet、ScrollArea
- 替换自建 ActionButton → shadcn Button
- 替换自建 FormInput → shadcn Input + Label
- 替换自建 Modal → shadcn Dialog
- 替换自建 Card → shadcn Card
- 替换自建 Tabs → shadcn Tabs
- 替换自建 Avatar → shadcn Avatar
- 替换自建 StatusBadge → shadcn Badge（保留状态映射逻辑）
- 替换自建 Pagination → shadcn Pagination
- 替换自建 BottomSheet/ActionSheet → shadcn Sheet
- 保留无 shadcn 对应物的特色组件：LoadingSpinner、EmptyState、ErrorState、ListItem、SwipeAction、BackHeader、BottomNav、Sidebar、ListDetailLayout、AdminShell（但统一其样式为语义 token）
- 统一全站硬编码色值（bg-slate-*、text-slate-* 等）为 shadcn 语义 token（bg-background、text-foreground 等）
- 更新 ui/index.ts 导出结构，兼容新旧导入路径

## Impact
- Affected specs: 全部 UI 组件、全部视图文件
- Affected code: src/components/ui/（19 个自建组件 + 5 个新 shadcn 组件）、src/views/（20+ 视图文件）、src/components/（NavBar、CommentPanel 等业务组件）、src/style.css、src/components/ui/design-tokens.css

## ADDED Requirements

### Requirement: shadcn-vue Button 组件
系统 SHALL 提供 shadcn-vue Button 组件，支持 variant（default/destructive/outline/secondary/ghost/link）和 size（default/sm/lg/icon），使用 CVA 定义变体，使用 bg-primary/text-primary-foreground 等语义 token。

#### Scenario: 替换 ActionButton
- **WHEN** 视图文件导入 ActionButton
- **THEN** 应改为从 `@/components/ui/button` 导入 Button，variant 映射为 primary→default, secondary→secondary, danger→destructive, warning→outline, ghost→ghost, outline→outline

### Requirement: shadcn-vue Input 组件
系统 SHALL 提供 shadcn-vue Input 组件，支持标准 input 属性和 class 覆盖，使用 border-input、bg-background、ring-ring 等语义 token。

#### Scenario: 替换 FormInput
- **WHEN** 视图文件导入 FormInput
- **THEN** 应改为使用 shadcn Input + Label 组合，label/error/hint 逻辑由使用方自行组合

### Requirement: shadcn-vue Dialog 组件
系统 SHALL 提供 shadcn-vue Dialog 组件（DialogContent、DialogHeader、DialogTitle、DialogDescription、DialogFooter、DialogClose），基于 reka-ui DialogRoot，使用 bg-background、text-foreground 等语义 token。

#### Scenario: 替换 Modal
- **WHEN** 视图文件导入 Modal
- **THEN** 应改为使用 Dialog 组件组合，Modal 的 sheet 模式由 Sheet 组件替代

### Requirement: shadcn-vue Card 组件
系统 SHALL 提供 shadcn-vue Card 组件（Card、CardHeader、CardTitle、CardDescription、CardContent、CardFooter），使用 bg-card、text-card-foreground 等语义 token。

#### Scenario: 替换自建 Card
- **WHEN** 视图文件导入 Card
- **THEN** 应改为使用 shadcn Card 子组件组合，variant 样式通过 class 覆盖实现

### Requirement: shadcn-vue Tabs 组件
系统 SHALL 提供 shadcn-vue Tabs 组件（Tabs、TabsList、TabsTrigger、TabsContent），基于 reka-ui TabsRoot。

#### Scenario: 替换自建 Tabs
- **WHEN** 视图文件导入 Tabs
- **THEN** 应改为使用 shadcn Tabs 子组件组合

### Requirement: shadcn-vue Avatar 组件
系统 SHALL 提供 shadcn-vue Avatar 组件（Avatar、AvatarImage、AvatarFallback），基于 reka-ui AvatarRoot。

#### Scenario: 替换自建 Avatar
- **WHEN** 视图文件导入 Avatar
- **THEN** 应改为使用 shadcn Avatar 子组件组合

### Requirement: shadcn-vue Badge 组件
系统 SHALL 提供 shadcn-vue Badge 组件，支持 variant（default/secondary/destructive/outline），使用 CVA 定义变体。保留 StatusBadge 的状态映射逻辑作为 Badge 的封装。

#### Scenario: 替换 StatusBadge
- **WHEN** 视图文件导入 StatusBadge
- **THEN** 应改为使用 Badge 组件 + statusVariant 映射函数

### Requirement: shadcn-vue Pagination 组件
系统 SHALL 提供 shadcn-vue Pagination 组件（Pagination、PaginationList、PaginationListItem、PaginationPrev、PaginationNext、PaginationEllipsis），基于 reka-ui PaginationRoot。

#### Scenario: 替换自建 Pagination
- **WHEN** 视图文件导入 Pagination
- **THEN** 应改为使用 shadcn Pagination 子组件组合

### Requirement: shadcn-vue Sheet 组件
系统 SHALL 提供 shadcn-vue Sheet 组件（Sheet、SheetTrigger、SheetContent、SheetHeader、SheetTitle、SheetDescription、SheetClose、SheetFooter），基于 reka-ui DialogRoot，支持 side 属性（top/bottom/left/right）。

#### Scenario: 替换 BottomSheet 和 ActionSheet
- **WHEN** 视图文件导入 BottomSheet 或 ActionSheet
- **THEN** 应改为使用 Sheet 组件 side="bottom" 模式

### Requirement: shadcn-vue Label 组件
系统 SHALL 提供 shadcn-vue Label 组件，基于 reka-ui Label，使用 text-foreground 等语义 token。

### Requirement: shadcn-vue Separator 组件
系统 SHALL 提供 shadcn-vue Separator 组件，基于 reka-ui Separator，使用 bg-border 语义 token。

### Requirement: shadcn-vue ScrollArea 组件
系统 SHALL 提供 shadcn-vue ScrollArea 组件，基于 reka-ui ScrollArea。

### Requirement: 统一样式 token
全站所有硬编码的 Tailwind 色值 SHALL 逐步替换为 shadcn 语义 token：
- `bg-slate-100 dark:bg-slate-700` → `bg-secondary`
- `bg-white dark:bg-slate-800` → `bg-card`
- `text-slate-700 dark:text-slate-200` → `text-foreground`
- `text-slate-500 dark:text-slate-400` → `text-muted-foreground`
- `border-slate-200 dark:border-slate-700` → `border-border`
- `bg-slate-50 dark:bg-slate-800` → `bg-accent`
- `hover:bg-slate-100 dark:hover:bg-slate-700` → `hover:bg-accent`

#### Scenario: 保留的特色组件样式统一
- **WHEN** LoadingSpinner、EmptyState、ErrorState、ListItem、SwipeAction、BackHeader、BottomNav、Sidebar、ListDetailLayout、AdminShell 等特色组件使用硬编码色值
- **THEN** 应替换为语义 token，保持视觉效果不变

## MODIFIED Requirements

### Requirement: ui/index.ts 导出结构
原 ui/index.ts 集中导出所有自建组件。修改为：
- 保留对特色组件的导出（LoadingSpinner、EmptyState、ErrorState、ListItem、SwipeAction、BackHeader、BottomNav、Sidebar、ListDetailLayout、AdminShell）
- 移除已被 shadcn 替换的组件导出（ActionButton、FormInput、Modal、Card、Tabs、Avatar、StatusBadge、Pagination、BottomSheet、ActionSheet）
- 视图文件应改为从各自 shadcn 子目录导入（如 `@/components/ui/button`）

### Requirement: design-tokens.css
保留现有 design-tokens.css 中的品牌色系统（--color-brand-*）、触控规范（--touch-*）、间距系统（--space-*）等自定义 token。这些 token 不在 shadcn 标准体系中，但通过 style.css 中的映射（--primary: var(--color-brand-500)）与 shadcn 体系桥接。
