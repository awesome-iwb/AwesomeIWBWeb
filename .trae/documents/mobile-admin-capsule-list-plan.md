# 手机版后台适配计划 — 底栏 Tab + 列表胶囊化

## 一、当前问题

### 移动端 ListDetailLayout 体验差
- 列表和详情**同时显示**，各占约一半屏幕，详情内容被严重压缩
- 选中项目后列表不会自动收起，用户必须手动点"收起列表"
- 没有返回按钮（BackHeader 的 `showBack` 被设为 `false`），用户无法从详情回到列表
- 列表收起后只显示一个丑陋的"展开列表"文字按钮，缺乏视觉引导

### 移动端导航
- BottomNav 已集成但体验可优化
- 侧边栏在移动端正确隐藏

## 二、设计目标

### 核心交互：列表胶囊化

当用户在移动端选中一个列表项查看详情时，列表不应该消失或变成一个文字按钮，而是**收缩为一个浮动的圆角矩形胶囊**，悬浮在详情内容上方。这个胶囊：

```
┌──────────────────────────────────────────┐
│  ← 项目管理                              │  ← 顶部栏
├──────────────────────────────────────────┤
│                                          │
│  ┌──────────────────────────────────┐    │
│  │ 📦 项目名称  ▾                    │    │  ← 列表胶囊（浮动）
│  └──────────────────────────────────┘    │
│                                          │
│  项目详情内容...                          │  ← 详情区域（可滚动）
│  名称: xxx                               │
│  描述: xxx                               │
│  ...                                     │
│                                          │
├──────────────────────────────────────────┤
│  📊  📦  ✅  👥  ☰                       │  ← 底栏 Tab
└──────────────────────────────────────────┘
```

**胶囊的交互：**
- 点击胶囊 → 展开列表（从胶囊位置向下展开，覆盖详情区域）
- 列表展开后点击列表项 → 重新收起为胶囊，显示新选中的项
- 胶囊显示当前选中项的图标和名称

**列表展开时的状态：**
```
┌──────────────────────────────────────────┐
│  ← 项目管理                              │
├──────────────────────────────────────────┤
│  🔍 搜索...                              │
│  ──────────────────                      │
│  📦 项目 A                               │
│  📦 项目 B ← 选中                        │  ← 列表展开（覆盖详情）
│  📦 项目 C                               │
│  📦 项目 D                               │
│  ──────────────────                      │
│  ‹ 1/5 ›                                │
├──────────────────────────────────────────┤
│  📊  📦  ✅  👥  ☰                       │
└──────────────────────────────────────────┘
```

## 三、具体实现方案

### Step 1：改造 ListDetailLayout 移动端交互

**文件：** `frontend/src/components/ui/ListDetailLayout.vue`

**核心变更：**

1. **新增移动端状态机**：`mobileView: 'list' | 'capsule'`
   - `'list'`：列表全屏展示，详情隐藏（初始状态 / 无选中项时）
   - `'capsule'`：列表收缩为胶囊，详情全屏展示（有选中项时）

2. **自动状态切换**：
   - 当 `selectedId` 变为有值且 `isStacked` 为 true → `mobileView = 'capsule'`
   - 当 `selectedId` 变为空 → `mobileView = 'list'`
   - 点击胶囊 → `mobileView = 'list'`
   - 在列表展开状态下点击列表项 → `mobileView = 'capsule'`

3. **移除旧的 `isListCollapsed` 逻辑**，替换为新的 `mobileView` 状态机

4. **胶囊组件**（内联在 ListDetailLayout 中）：
   ```html
   <!-- 浮动胶囊 -->
   <div v-if="isStacked && mobileView === 'capsule' && hasSelection"
     class="sticky top-0 z-10 mx-2 -mb-2 mt-2">
     <button
       class="w-full flex items-center gap-2 px-4 py-2.5 rounded-2xl
         bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl
         border border-white/70 dark:border-slate-700/70
         shadow-lg shadow-slate-900/8 dark:shadow-black/20
         active:scale-[0.98] transition-all duration-200"
       @click="mobileView = 'list'"
     >
       <component :is="selectedItemIcon" class="w-4 h-4 text-[var(--color-brand-500)]" />
       <span class="flex-1 text-left text-sm font-medium truncate">{{ selectedItemImage }}</span>
       <ChevronDown class="w-4 h-4 text-slate-400" />
     </button>
   </div>
   ```

5. **移动端列表全屏展示**：
   - `mobileView === 'list'` 时，列表面板占满高度（移除 `max-h-[40vh]` 限制）
   - 详情面板隐藏（`v-show="!isStacked || mobileView !== 'list'"`）

6. **移动端详情全屏展示**：
   - `mobileView === 'capsule'` 时，详情面板占满高度
   - 列表面板隐藏，只显示胶囊

7. **新增 `selectedItemLabel` prop**：让父视图传入当前选中项的显示名称，用于胶囊展示
   - 或者新增 `#capsule` slot 让父视图自定义胶囊内容

8. **桌面端不受影响**：所有变更仅在 `isStacked` 为 true 时生效

### Step 2：BackHeader 启用移动端返回按钮

**文件：** `frontend/src/components/ui/AdminShell.vue`

**变更：**
- 当移动端且当前视图使用了 ListDetailLayout 并有选中项时，BackHeader 显示返回按钮
- 方案：在 AdminShell 中添加一个响应式状态 `canGoBack`，由子视图通过 provide/inject 或 route meta 传递
- 更简单的方案：始终在移动端显示返回按钮，点击时执行 `router.back()` 或 emit `back` 事件

**最终方案：** 在 AdminShell 中将 `showBack` 改为在移动端始终为 `true`，点击时执行 `router.back()`。这样用户可以在任何页面返回上一页。

### Step 3：各视图适配胶囊

**需要修改的视图（所有使用 ListDetailLayout 的视图）：**

每个视图需要：
1. 传入 `selectedItemLabel` prop（当前选中项的名称/标题）
2. 在列表项点击时，如果 `isStacked`，自动触发列表收起（通过 ListDetailLayout 的内部逻辑自动处理）

**涉及文件：**
- `views/admin/ProjectsView.vue`
- `views/admin/UsersView.vue`
- `views/admin/SubmissionsView.vue`
- `views/admin/DevelopersView.vue`
- `views/admin/MediaView.vue`
- `views/admin/AuditView.vue`
- `views/admin/StoriesView.vue`
- `views/admin/AdminClaimsView.vue`
- `views/admin/AdminOrganizationsView.vue`

### Step 4：Dev 视图移动端优化（可选）

Dev 视图不使用 ListDetailLayout，它们使用卡片网格和模态框。这些视图的移动端体验已经基本可用，不需要列表胶囊化。但如果需要，可以：
- DevProjectsView：项目卡片在移动端已经是单列，点击进入详情页（router-link），体验尚可
- DevBugsView / DevCommentsView：列表+模态框模式，移动端可用

**结论：** Dev 视图暂不需要修改。

## 四、详细技术设计

### ListDetailLayout 新增 Props

```ts
selectedItemLabel?: string;   // 胶囊中显示的文字
selectedItemIcon?: any;       // 胶囊中显示的图标组件
```

### ListDetailLayout 新增状态

```ts
const mobileView = ref<'list' | 'capsule'>('list');

// 自动切换：选中项变化时
watch(() => props.selectedId, (newId) => {
  if (isStacked.value) {
    mobileView.value = newId ? 'capsule' : 'list';
  }
});

// 断点变化时重置
watch(isStacked, (stacked) => {
  if (!stacked) {
    mobileView.value = 'list';
  }
});
```

### ListDetailLayout 模板结构（移动端）

```html
<!-- 移动端：列表全屏 -->
<template v-if="isStacked && mobileView === 'list'">
  <section class="flex-1 min-h-0 ... flex flex-col">
    <!-- 搜索栏 -->
    <!-- 列表内容 -->
    <!-- 分页 -->
  </section>
</template>

<!-- 移动端：详情 + 胶囊 -->
<template v-if="isStacked && mobileView === 'capsule'">
  <section class="flex-1 min-h-0 ... flex flex-col">
    <!-- 浮动胶囊 -->
    <div class="sticky top-0 z-10 ...">
      <button @click="mobileView = 'list'" ...>
        <component :is="selectedItemIcon" />
        <span>{{ selectedItemLabel }}</span>
        <ChevronDown />
      </button>
    </div>
    <!-- 详情内容 -->
    <div class="flex-1 min-h-0 overflow-y-auto">
      <slot name="detail" />
    </div>
  </section>
</template>

<!-- 桌面端：不变 -->
<template v-if="!isStacked">
  <!-- 原有的左右分栏布局 -->
</template>
```

**注意：** 实际实现时不能用 `v-if` 切换整个模板（会导致 DOM 重建、滚动位置丢失），应该用 CSS class 切换可见性。

### AdminShell 返回按钮

```html
<ui-BackHeader
  :title="pageTitle"
  :user-name="user?.name"
  :show-back="isMobile"
  @back="router.back()"
  @go-home="$emit('goHome')"
  @logout="$emit('logout')"
/>
```

其中 `isMobile` 使用 `useMediaQuery('(max-width: 1023px)')`。

## 五、实施步骤

1. **改造 ListDetailLayout**：实现移动端状态机 + 胶囊组件 + 列表/详情切换
2. **修改 AdminShell**：启用移动端返回按钮
3. **适配各 admin 视图**：传入 selectedItemLabel 和 selectedItemIcon
4. **构建验证**：vite build + vue-tsc

## 六、风险和注意事项

- **滚动位置保持**：列表展开/收起时需要保持滚动位置，避免使用 `v-if` 导致 DOM 重建
- **胶囊内容来源**：需要父视图提供选中项的标签和图标，这是新增的 prop 契约
- **桌面端不受影响**：所有变更仅在 `isStacked` 时生效，桌面端行为完全不变
- **DevelopersView 的 Tab 栏**：在移动端列表全屏时，Tab 栏应该在列表上方显示
