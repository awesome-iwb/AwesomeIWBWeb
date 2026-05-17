# Awesome Design — 设计规范文档

> Awesome IWB Web 统一设计系统，代号 **Awesome Design**

---

## 一、设计理念

Awesome Design 遵循三个核心原则：

1. **圆润柔和** — 大圆角、柔和阴影、毛玻璃质感，传递友好与专业
2. **层次分明** — 通过阴影深度、背景透明度、边框粗细区分信息层级
3. **品牌双生** — Admin（emerald 翡翠绿）与 Dev（blue 天际蓝）两套品牌色，共享同一套结构规范

---

## 二、色彩体系

### 2.1 品牌色

| 语境 | 主色 | 主色深 | 主色浅 | 渐变 |
|------|------|--------|--------|------|
| Admin | `emerald-500` #10b981 | `emerald-600` #059669 | `emerald-50` #ecfdf5 | `from-emerald-500 to-teal-500` |
| Dev | `blue-500` #3b82f6 | `blue-600` #2563eb | `blue-50` #eff6ff | `from-blue-500 to-indigo-500` |
| 公共 | `emerald-500` | `emerald-600` | `emerald-50` | 同 Admin |

**规则**：
- 品牌色仅用于：主按钮、选中态、侧边栏高亮、Logo 渐变、Spinner、Focus 边框
- 同一页面内不得混用两套品牌色
- Admin 后台内所有交互元素统一使用 emerald，不得出现 blue 作为主操作色

### 2.2 语义色

| 语义 | 色值 | 浅底 | 暗色模式浅底 | 用途 |
|------|------|------|-------------|------|
| 成功/通过 | `emerald-500` | `bg-emerald-50` | `dark:bg-emerald-500/10` | 审核通过、操作成功 |
| 警告/待审 | `amber-500` | `bg-amber-50` | `dark:bg-amber-500/10` | 待审核、需注意 |
| 危险/拒绝 | `rose-500` | `bg-rose-50` | `dark:bg-rose-500/10` | 删除、拒绝、错误 |
| 信息/中性 | `blue-500` | `bg-blue-50` | `dark:bg-blue-500/10` | 提示、信息 |
| 紫色/特殊 | `purple-500` | `bg-purple-50` | `dark:bg-purple-500/10` | 统计、特殊标记 |

**暗色模式规则**：
- 语义色浅底统一使用 `dark:{color}-500/10`（10% 透明度）
- 语义色文字统一使用 `dark:{color}-400`
- 禁止使用 `dark:{color}-900/30`，统一改为 `/10` 透明度写法

### 2.3 中性色

| 用途 | 亮色 | 暗色 |
|------|------|------|
| 页面背景 | `bg-slate-50` | `dark:bg-slate-900` |
| 卡片背景 | `bg-white` | `dark:bg-slate-800` |
| 卡片背景（次级） | `bg-slate-50` | `dark:bg-slate-900/50` |
| 主文字 | `text-slate-900` | `dark:text-white` |
| 次要文字 | `text-slate-500` | `dark:text-slate-400` |
| 辅助文字 | `text-slate-400` | `dark:text-slate-500` |
| 边框（主） | `border-slate-200` | `dark:border-slate-700` |
| 边框（次/分隔线） | `border-slate-100` | `dark:border-slate-700` |
| 边框（轻/悬浮） | `border-slate-200/80` | `dark:border-slate-800/80` |

---

## 三、圆角体系

圆角是 Awesome Design 最核心的视觉特征，统一为 **5 级圆角**：

| Token 名 | 值 | Tailwind 类 | 用途 |
|-----------|-----|------------|------|
| `radius-sm` | 0.375rem (6px) | `rounded-md` | 小型徽章、Tag |
| `radius-md` | 0.75rem (12px) | `rounded-xl` | 按钮、输入框、头像占位、小卡片内元素 |
| `radius-lg` | 1rem (16px) | `rounded-2xl` | 卡片、列表项容器、统计卡片 |
| `radius-xl` | 1.5rem (24px) | `rounded-3xl` | 面板、弹窗、大卡片、主内容区 |
| `radius-full` | 9999px | `rounded-full` | 头像、圆形按钮、状态徽章 |

**映射规则**：

| 元素 | 圆角级别 |
|------|----------|
| 页面级面板（左右分栏面板） | `radius-xl` (rounded-3xl) |
| 内容卡片（统计卡、项目卡、组织卡） | `radius-lg` (rounded-2xl) |
| 弹窗/对话框 | `radius-xl` (rounded-3xl) |
| 浮动弹出层（BottomNav 更多） | `radius-xl` (rounded-2xl，两侧留边) |
| 按钮（主/次/危险） | `radius-md` (rounded-xl) |
| 输入框 | `radius-md` (rounded-xl) |
| 状态徽章（pending/approved） | `radius-full` (rounded-full) |
| 角色/语言标签 | `radius-sm` (rounded-md) |
| 用户头像 | `radius-full` (rounded-full) |
| 项目/组织图标 | `radius-md` (rounded-xl) |
| 侧边栏导航项 | `radius-md` (rounded-xl) |

**禁止使用的圆角**：
- ❌ `rounded` (4px) — 太小，与体系不符
- ❌ `rounded-lg` (8px) — 与 `rounded-xl` 太接近，统一用 `rounded-xl`
- ❌ `rounded-2xl` 用于弹窗 — 弹窗统一用 `rounded-3xl`

---

## 四、阴影体系

| Token 名 | 值 | 用途 |
|-----------|-----|------|
| `shadow-card` | `shadow-sm` | 静态卡片 |
| `shadow-card-hover` | `shadow-md` | 卡片悬浮态 |
| `shadow-elevated` | `shadow-lg shadow-slate-900/5 dark:shadow-black/20` | 浮动面板、侧边栏选中项 |
| `shadow-modal` | `shadow-2xl shadow-slate-900/10 dark:shadow-black/30` | 弹窗、对话框 |
| `shadow-brand` | `shadow-md shadow-{brand}-500/20` | 品牌色按钮、选中项 |

**规则**：
- 静态卡片只用 `shadow-sm`，悬浮时升至 `shadow-md`
- 弹窗必须使用 `shadow-2xl` + 带色调阴影
- 品牌色按钮/选中项必须带品牌色阴影 `shadow-{brand}-500/20`

---

## 五、间距体系

### 5.1 内边距

| 元素 | 内边距 |
|------|--------|
| 页面内容区 | `p-4 lg:p-6` |
| 卡片 | `p-5` 或 `p-4 lg:p-6` |
| 列表项 | `p-3` |
| 表单组 | `space-y-4` |
| 弹窗内容 | `p-6 lg:p-8` |
| 弹窗头部 | `p-4 lg:p-6 border-b` |
| 弹窗底部 | `p-4 lg:p-6 border-t` |

### 5.2 元素间距

| 场景 | 间距 |
|------|------|
| 页面区块之间 | `space-y-4 lg:space-y-6` |
| 卡片网格 | `gap-4` |
| 列表项之间 | `space-y-1` (侧边栏) / `divide-y` (列表) |
| 表单标签与输入框 | `mb-2` |
| 按钮组 | `gap-2` |

---

## 六、排版体系

### 6.1 字号

| Token | 大小 | 用途 |
|-------|------|------|
| `text-xs` | 12px | 辅助信息、时间戳、标签 |
| `text-sm` | 14px | 正文、表单标签、列表项 |
| `text-base` | 16px | 输入框文字、主要正文 |
| `text-lg` | 18px | 区块标题 |
| `text-xl` | 20px | 页面副标题 |
| `text-2xl` | 24px | 页面主标题、统计数字 |
| `text-3xl` | 30px | 大标题（极少使用） |

### 6.2 字重

| Token | 值 | 用途 |
|-------|-----|------|
| `font-medium` | 500 | 次要标签、导航文字 |
| `font-bold` | 700 | 标题、按钮文字 |
| `font-extrabold` | 800 | 主标题、统计数字、用户名 |

### 6.3 字体

```css
--font-sans: "Inter", system-ui, -apple-system, sans-serif;
```

代码/等宽字体使用 Tailwind `font-mono`。

---

## 七、组件规范

### 7.1 按钮 (ActionButton)

| 变体 | 样式 |
|------|------|
| `primary` | `bg-{brand}-500 hover:bg-{brand}-600 text-white shadow-lg shadow-{brand}-500/20 rounded-xl px-4 py-2.5 text-sm font-bold` |
| `secondary` | `bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl px-4 py-2.5 text-sm font-bold` |
| `danger` | `bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20 rounded-xl px-4 py-2.5 text-sm font-bold` |
| `warning` | `bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20 rounded-xl px-4 py-2.5 text-sm font-bold` |
| `ghost` | `text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl px-4 py-2.5 text-sm font-bold` |
| `outline` | `border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl px-4 py-2.5 text-sm font-bold` |

**尺寸**：

| 尺寸 | 内边距 | 字号 |
|------|--------|------|
| `sm` | `px-3 py-1.5` | `text-xs` |
| `md` (默认) | `px-4 py-2.5` | `text-sm` |
| `lg` | `px-6 py-3` | `text-base` |

**禁用态**：`disabled:opacity-50 disabled:cursor-not-allowed`

### 7.2 输入框 (FormInput)

```
w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700
bg-slate-50 dark:bg-slate-900 outline-none
focus:border-{brand}-500 transition-colors text-base
placeholder:text-slate-400
```

**错误态**：`border-rose-500 focus:border-rose-500`
**标签**：`block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2`

### 7.3 卡片 (Card)

| 变体 | 样式 |
|------|------|
| `default` | `bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm` |
| `elevated` | 同上 + `shadow-lg shadow-slate-900/5 dark:shadow-black/20` |
| `interactive` | 同 default + `hover:shadow-md hover:border-{brand}-200 dark:hover:border-{brand}-800 cursor-pointer transition-all` |
| `panel` | `bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden` |
| `glass` | `bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-slate-700/60 shadow-xl` |

### 7.4 弹窗 (Modal)

**遮罩层**：`fixed inset-0 bg-black/50 backdrop-blur-sm z-50`

**容器**：
```
bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700
shadow-2xl shadow-slate-900/10 dark:shadow-black/30
max-w-lg w-full mx-auto
```

**头部**：`px-6 py-4 border-b border-slate-100 dark:border-slate-700`
**内容**：`px-6 py-4`
**底部**：`px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2`

**动画**：
- 进入：`transition duration-300 ease-out` from `opacity-0 scale-95` to `opacity-100 scale-100`
- 离开：`transition duration-200 ease-in` from `opacity-100 scale-100` to `opacity-0 scale-95`

### 7.5 分页器 (Pagination)

```
上一页/下一页按钮：px-3 py-2 rounded-xl text-sm font-bold
  默认：bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200
  悬浮：hover:bg-slate-200 dark:hover:bg-slate-600
  禁用：disabled:opacity-40 disabled:cursor-not-allowed
页码指示：text-sm text-slate-500 dark:text-slate-400
```

### 7.6 加载状态 (LoadingSpinner)

```
容器：flex items-center justify-center py-20
Spinner：w-8 h-8 border-[3px] border-{brand}-500/30 border-t-{brand}-500 rounded-full animate-spin
文字（可选）：text-sm text-slate-400 mt-3
```

### 7.7 空状态 (EmptyState)

```
容器：text-center py-10 px-4
图标：w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-600
标题：text-sm font-bold text-slate-500 dark:text-slate-400
描述（可选）：text-xs text-slate-400 dark:text-slate-500 mt-1
操作按钮（可选）：mt-4
```

### 7.8 状态徽章 (StatusBadge)

| 状态 | 浅底 | 文字 | 暗底 | 暗文字 |
|------|------|------|------|--------|
| `pending` | `bg-amber-50` | `text-amber-600` | `dark:bg-amber-500/10` | `dark:text-amber-400` |
| `approved` | `bg-emerald-50` | `text-emerald-600` | `dark:bg-emerald-500/10` | `dark:text-emerald-400` |
| `rejected` | `bg-rose-50` | `text-rose-600` | `dark:bg-rose-500/10` | `dark:text-rose-400` |
| `active` | `bg-emerald-50` | `text-emerald-600` | `dark:bg-emerald-500/10` | `dark:text-emerald-400` |
| `inactive` | `bg-slate-100` | `text-slate-500` | `dark:bg-slate-700` | `dark:text-slate-400` |

**通用样式**：`text-[10px] px-1.5 py-0.5 rounded-full font-bold`

### 7.9 头像 (Avatar)

| 尺寸 | 宽高 | 用途 |
|------|------|------|
| `xs` | `w-6 h-6` | 回复中的小头像 |
| `sm` | `w-8 h-8` | 列表项、评论 |
| `md` | `w-10 h-10` | 用户详情、成员列表 |
| `lg` | `w-16 h-16` | 个人主页 |
| `xl` | `w-20 h-20` | 个人主页大头像 |

**占位符**：`bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 font-extrabold`
**用户头像圆角**：`rounded-full`
**项目/组织图标圆角**：`rounded-xl`

### 7.10 浮动弹出层 (FloatingPanel / BottomNav 更多)

```
容器：absolute bottom-16 left-3 right-3
  bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl
  rounded-2xl border border-slate-200/80 dark:border-slate-700/80
  shadow-2xl shadow-slate-900/10 dark:shadow-black/30
  overflow-hidden

遮罩：fixed inset-0 bg-black/20 backdrop-blur-sm z-[-1]

动画进入：transition duration-300 ease-out from translate-y-4 opacity-0 scale-95
动画离开：transition duration-200 ease-in to translate-y-4 opacity-0 scale-95
```

---

## 八、动画与过渡

| 场景 | 时长 | 缓动 | 效果 |
|------|------|------|------|
| 页面路由切换 | 250ms | `cubic-bezier(0.25, 1, 0.5, 1)` | 滑入滑出 |
| 弹窗出现 | 300ms | `ease-out` | `opacity + scale(0.95→1)` |
| 弹窗消失 | 200ms | `ease-in` | `opacity + scale(1→0.95)` |
| 浮动层出现 | 300ms | `ease-out` | `translateY + opacity + scale` |
| 浮动层消失 | 200ms | `ease-in` | 反向 |
| 悬浮反馈 | 150ms | `ease` | 颜色/阴影变化 |
| 按钮点击 | 即时 | — | `active:scale-95` |

---

## 九、响应式断点

| 断点 | 宽度 | 典型设备 |
|------|------|----------|
| 默认 | < 640px | 手机 |
| `sm` | ≥ 640px | 大手机 |
| `md` | ≥ 768px | 平板 |
| `lg` | ≥ 1024px | 桌面（侧边栏出现） |
| `xl` | ≥ 1280px | 大桌面 |

**关键规则**：
- 侧边栏在 `lg` 以上显示，以下隐藏
- 底部导航在 `lg` 以下显示，以上隐藏
- 卡片内边距 `p-4 lg:p-6`
- 区块间距 `space-y-4 lg:space-y-6`

---

## 十、暗色模式规范

1. 所有组件必须同时定义亮色和暗色样式
2. 暗色模式通过 CSS 类 `.dark` 切换（非 media query）
3. 暗色语义色浅底统一用 `{color}-500/10` 透明度写法
4. 暗色卡片背景统一 `dark:bg-slate-800`，禁止 `dark:bg-slate-900` 用于卡片
5. 暗色弹窗背景统一 `dark:bg-slate-800`，遮罩统一 `bg-black/50 backdrop-blur-sm`
6. 暗色边框统一 `dark:border-slate-700`，分隔线 `dark:border-slate-700`

---

## 十一、实施计划

### Step 1：创建 Awesome Design 基础设施

- 创建 `frontend/src/components/ui/` 目录
- 创建 `frontend/src/components/ui/design-tokens.css` — 将上述所有 Token 定义为 CSS 变量
- 扩展 `frontend/src/style.css` — 引入 design-tokens.css，添加品牌色 CSS 变量
- 在 `AdminLayout.vue` 根元素添加 `data-brand="admin"`
- 在 `DevLayout.vue` 根元素添加 `data-brand="dev"`

### Step 2：实现 Phase 1 组件（消除最大重复）

创建 4 个核心组件：
1. `ui/Pagination.vue` — 分页器（替换 11 处）
2. `ui/Modal.vue` — 弹窗（替换 8+ 处）
3. `ui/LoadingSpinner.vue` — 加载状态（替换 10+ 处）
4. `ui/EmptyState.vue` — 空状态（替换 8+ 处）
5. `ui/index.ts` — 统一导出

### Step 3：替换 Phase 1 组件

逐文件替换内联实现为 UI 组件调用，同时修复不一致问题：
- 统一弹窗圆角为 `rounded-3xl`
- 统一弹窗背景为 `dark:bg-slate-800`
- 统一遮罩为 `bg-black/50 backdrop-blur-sm`
- 统一 admin 内部品牌色（ProjectsView 的 blue → emerald）

### Step 4：实现 Phase 2 组件（统一视觉规范）

创建 4 个规范组件：
1. `ui/StatusBadge.vue` — 状态徽章（统一 pending/approved/rejected 映射和暗色样式）
2. `ui/FormInput.vue` — 表单输入框（统一 focus 色、内边距、圆角）
3. `ui/Avatar.vue` — 头像（统一尺寸、圆角、占位符背景色）
4. `ui/ActionButton.vue` — 按钮（统一圆角、阴影、品牌色）

### Step 5：替换 Phase 2 组件 + 修复品牌色不一致

- 替换各文件中的内联徽章、输入框、头像、按钮
- 修复 admin 内部品牌色不一致（ProjectsView 列表选中 blue → emerald，表单 focus blue → emerald）
- 统一 DashboardCard 在 dev 后台的复用

### Step 6：实现 Phase 3 组件 + Composables

1. `ui/Card.vue` — 卡片容器
2. `ui/Tabs.vue` — 标签页
3. `composables/useFormatTime.ts` — 时间格式化
4. `composables/useStatusMap.ts` — 状态映射

### Step 7：验证 + 清理

- 前端类型检查 `vue-tsc --noEmit`
- 构建验证 `vite build`
- 删除不再使用的内联样式和重复代码
- 全局搜索确认无残留不一致样式
