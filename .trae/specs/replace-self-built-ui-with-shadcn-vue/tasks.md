# Tasks

- [x] Task 1: 创建 shadcn-vue 基础组件 — Button、Input、Label、Separator
  - [x] 1.1: 创建 `ui/button/` 目录，编写 Button.vue（CVA 变体：default/destructive/outline/secondary/ghost/link，size：default/sm/lg/icon）和 index.ts
  - [x] 1.2: 创建 `ui/input/` 目录，编写 Input.vue（标准 input 封装，语义 token）和 index.ts
  - [x] 1.3: 创建 `ui/label/` 目录，编写 Label.vue（基于 reka-ui Label）和 index.ts
  - [x] 1.4: 创建 `ui/separator/` 目录，编写 Separator.vue（基于 reka-ui Separator）和 index.ts

- [x] Task 2: 创建 shadcn-vue 复合组件 — Dialog、Sheet、ScrollArea
  - [x] 2.1: 创建 `ui/dialog/` 目录，编写 DialogContent.vue、DialogHeader.vue、DialogTitle.vue、DialogDescription.vue、DialogFooter.vue、DialogClose.vue、DialogScrollContent.vue 和 index.ts
  - [x] 2.2: 创建 `ui/sheet/` 目录，编写 SheetContent.vue、SheetHeader.vue、SheetTitle.vue、SheetDescription.vue、SheetClose.vue、SheetFooter.vue 和 index.ts（支持 side 属性）
  - [x] 2.3: 创建 `ui/scroll-area/` 目录，编写 ScrollArea.vue、ScrollBar.vue 和 index.ts

- [x] Task 3: 创建 shadcn-vue 展示组件 — Card、Tabs、Avatar、Badge、Pagination
  - [x] 3.1: 创建 `ui/card/` 目录，编写 Card.vue、CardHeader.vue、CardTitle.vue、CardDescription.vue、CardContent.vue、CardFooter.vue 和 index.ts
  - [x] 3.2: 创建 `ui/tabs/` 目录，编写 TabsList.vue、TabsTrigger.vue、TabsContent.vue 和 index.ts
  - [x] 3.3: 创建 `ui/avatar/` 目录，编写 AvatarImage.vue、AvatarFallback.vue 和 index.ts
  - [x] 3.4: 创建 `ui/badge/` 目录，编写 Badge.vue（CVA 变体）和 index.ts，同时创建 status-variant.ts 状态映射工具
  - [x] 3.5: 创建 `ui/pagination/` 目录，编写 PaginationList.vue、PaginationListItem.vue、PaginationPrev.vue、PaginationNext.vue、PaginationEllipsis.vue 和 index.ts

- [x] Task 4: 替换视图文件中的自建组件导入 — 第一批（ActionButton → Button、FormInput → Input+Label）
  - [x] 4.1: 搜索所有使用 ActionButton 的视图文件，替换为 Button 导入和对应 variant 映射
  - [x] 4.2: 搜索所有使用 FormInput 的视图文件，替换为 Input + Label 组合
  - [x] 4.3: 删除旧 ActionButton.vue 和 FormInput.vue

- [x] Task 5: 替换视图文件中的自建组件导入 — 第二批（Modal → Dialog、BottomSheet/ActionSheet → Sheet）
  - [x] 5.1: 搜索所有使用 Modal 的视图文件，替换为 Dialog 组件组合
  - [x] 5.2: 搜索所有使用 BottomSheet/ActionSheet 的视图文件，替换为 Sheet side="bottom"
  - [x] 5.3: 删除旧 Modal.vue、BottomSheet.vue、ActionSheet.vue

- [x] Task 6: 替换视图文件中的自建组件导入 — 第三批（Card、Tabs、Avatar、StatusBadge、Pagination）
  - [x] 6.1: 搜索所有使用 Card 的视图文件，替换为 shadcn Card 子组件组合
  - [x] 6.2: 搜索所有使用 Tabs 的视图文件，替换为 shadcn Tabs 子组件组合
  - [x] 6.3: 搜索所有使用 Avatar 的视图文件，替换为 shadcn Avatar 子组件组合
  - [x] 6.4: 搜索所有使用 StatusBadge 的视图文件，替换为 Badge + statusVariant
  - [x] 6.5: 搜索所有使用 Pagination 的视图文件，替换为 shadcn Pagination 子组件组合
  - [x] 6.6: 删除旧 Card.vue、Tabs.vue、Avatar.vue、StatusBadge.vue、Pagination.vue

- [x] Task 7: 统一保留特色组件的样式 token
  - [x] 7.1: 更新 LoadingSpinner.vue — 将 `text-slate-500 dark:text-slate-400` 替换为 `text-muted-foreground`
  - [x] 7.2: 更新 EmptyState.vue — 将硬编码色值替换为语义 token
  - [x] 7.3: 更新 ErrorState.vue — 将硬编码色值替换为语义 token
  - [x] 7.4: 更新 ListItem.vue — 将 `bg-white dark:bg-slate-800`、`border-slate-200 dark:border-slate-700` 等替换为语义 token
  - [x] 7.5: 更新 SwipeAction.vue — 将硬编码色值替换为语义 token
  - [x] 7.6: 更新 BackHeader.vue — 将硬编码色值替换为语义 token
  - [x] 7.7: 更新 BottomNav.vue — 将硬编码色值替换为语义 token
  - [x] 7.8: 更新 Sidebar.vue — 将硬编码色值替换为语义 token
  - [x] 7.9: 更新 ListDetailLayout.vue — 将硬编码色值替换为语义 token
  - [x] 7.10: 更新 AdminShell.vue — 将硬编码色值替换为语义 token

- [x] Task 8: 统一业务组件和视图文件中的硬编码色值
  - [x] 8.1: 更新 NavBar.vue — 替换硬编码色值为语义 token
  - [x] 8.2: 更新 CommentPanel.vue — 替换硬编码色值为语义 token
  - [x] 8.3: 更新 CommandPalette.vue — 替换硬编码色值为语义 token
  - [x] 8.4: 更新 HomeView.vue — 替换硬编码色值和内联 style
  - [x] 8.5: 更新其他视图文件中的硬编码色值（44+ 个 .vue 文件）

- [x] Task 9: 更新 ui/index.ts 导出和清理
  - [x] 9.1: 更新 ui/index.ts — 移除已替换组件的导出，保留特色组件导出
  - [x] 9.2: 验证所有导入路径正确，无断裂引用
  - [x] 9.3: 运行 `npm run build` 确认构建通过

# Task Dependencies
- [Task 4] depends on [Task 1]
- [Task 5] depends on [Task 2]
- [Task 6] depends on [Task 3]
- [Task 7] 独立于 Task 4-6，可并行执行
- [Task 8] depends on [Task 1, 2, 3]
- [Task 9] depends on [Task 4, 5, 6, 7, 8]
- [Task 1, 2, 3] 可并行执行
