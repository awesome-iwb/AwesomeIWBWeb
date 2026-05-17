# Awesome IWB 统一组件库设计方案

## 一、现状分析

### 1.1 问题严重程度

经过对 23 个组件文件和 37 个视图文件的全面审查，发现以下核心问题：

**严重（影响用户体验和代码维护）**：
- 分页器在 **11 个文件**中完全重复实现，改一处漏十处
- 列表选中色 admin 内部不一致：ProjectsView 用 `blue-500`，其他用 `emerald-500`，ModerationView 用 `amber-500`
- 弹窗样式不统一：圆角 `rounded-2xl` vs `rounded-3xl`，背景 `dark:bg-slate-800` vs `dark:bg-slate-900`，遮罩 `bg-black/40` vs `bg-black/50`

**中等（视觉不协调）**：
- 卡片圆角：后台面板 `rounded-2xl` vs `rounded-3xl` 混用
- 按钮圆角：`rounded-xl` / `rounded-2xl` / `rounded-lg` 三种
- 表单 focus 色：admin 内部 `emerald-500` vs `blue-500` 混用
- 徽章圆角：`rounded` vs `rounded-full` 混用
- 成员管理 UI 在 4 处独立实现，未全部复用 MemberManager
- DevDashboardView 未复用 DashboardCard 组件

**低（细节不统一）**：
- 时间格式化函数在 4+ 个文件重复
- 状态映射函数在 3+ 个文件重复且暗色样式不一致
- 头像占位符背景色不一致（蓝/灰/绿）
- CSS 变量几乎未使用（仅 `--background` 和 `--foreground`）

### 1.2 结论：有必要建立统一组件库

**理由**：
1. **11 个文件重复分页器** — 这是最大的维护隐患，任何样式调整都要改 11 处
2. **admin 内部品牌色混乱** — ProjectsView 的 `blue-500` 与其他视图的 `emerald-500` 不一致，说明缺乏统一的设计 token
3. **弹窗/对话框无统一规范** — 圆角、背景、遮罩层各不相同
4. **成员管理 UI 重复** — 已有 MemberManager 共享组件但未全面使用
5. **未来扩展需要** — 随着功能增长，不一致性只会加剧

## 二、设计原则

### 2.1 不是"造轮子"，是"收拢散落的轮子"

我们不需要从零搭建一套完整的 UI 框架。我们的目标是：
- 把**已经存在但分散重复**的 UI 模式抽取为统一组件
- 定义**设计 token**（颜色、圆角、间距等），消除硬编码
- 保持现有 Tailwind CSS 技术栈不变

### 2.2 渐进式迁移

- 新组件放在 `src/components/ui/` 目录下
- 旧页面逐步替换，不搞一次性大重构
- 每个组件独立可用，不依赖其他 UI 组件

### 2.3 品牌色体系

当前两个后台有明确的品牌色区分，这是**有意设计**，应保留：
- Admin 后台：`emerald` 系
- Dev 后台：`blue` 系
- 公共页面：`emerald` 系（与主站一致）

组件通过 `variant` prop 支持不同品牌色，而非硬编码。

## 三、设计 Token 体系

### 3.1 在 `tailwind.config.js` 中扩展主题

```js
// tailwind.config.js 扩展
theme: {
  extend: {
    borderRadius: {
      'card': '1rem',       // rounded-2xl → 统一为 card
      'panel': '1.5rem',    // rounded-3xl → 统一为 panel
      'input': '0.75rem',   // rounded-xl → 统一为 input
      'button': '0.75rem',  // rounded-xl → 统一为 button
      'badge': '9999px',    // rounded-full → 统一为 badge
    },
    colors: {
      brand: {
        50: 'var(--color-brand-50)',
        500: 'var(--color-brand-500)',
        600: 'var(--color-brand-600)',
      }
    }
  }
}
```

### 3.2 CSS 变量（按品牌切换）

```css
:root {
  --color-brand-50: #ecfdf5;    /* emerald-50 */
  --color-brand-500: #10b981;   /* emerald-500 */
  --color-brand-600: #059669;   /* emerald-600 */
}

[data-brand="dev"] {
  --color-brand-50: #eff6ff;    /* blue-50 */
  --color-brand-500: #3b82f6;   /* blue-500 */
  --color-brand-600: #2563eb;   /* blue-600 */
}
```

这样组件只需写 `bg-brand-500`，品牌色自动跟随上下文。

## 四、组件清单与优先级

### Phase 1：高优先级（消除最大重复）

| 组件 | 替换文件数 | 说明 |
|------|-----------|------|
| `ui/Pagination.vue` | 11 | 分页器，消除最大重复 |
| `ui/Modal.vue` | 8+ | 弹窗/对话框，统一遮罩/圆角/背景 |
| `ui/LoadingSpinner.vue` | 10+ | 加载状态，支持品牌色 |
| `ui/EmptyState.vue` | 8+ | 空状态，统一图标+文字+样式 |

### Phase 2：中优先级（统一视觉规范）

| 组件 | 替换文件数 | 说明 |
|------|-----------|------|
| `ui/StatusBadge.vue` | 6+ | 状态徽章，统一 pending/approved/rejected 映射 |
| `ui/FormInput.vue` | 8+ | 表单输入框，统一 focus 色/内边距/圆角 |
| `ui/Avatar.vue` | 10+ | 头像，统一尺寸/圆角/占位符 |
| `ui/ActionButton.vue` | 15+ | 操作按钮，统一圆角/阴影/品牌色 |

### Phase 3：低优先级（细节完善）

| 组件 | 替换文件数 | 说明 |
|------|-----------|------|
| `ui/Card.vue` | 20+ | 卡片容器，统一圆角/阴影/边框 |
| `ui/Tabs.vue` | 3+ | 标签页，统一样式 |
| composables `useFormatTime` | 4+ | 时间格式化函数抽取 |
| composables `useStatusMap` | 3+ | 状态映射函数抽取 |

## 五、组件 API 设计示例

### Pagination

```vue
<ui-Pagination
  v-model:page="currentPage"
  :total="totalItems"
  :page-size="20"
/>
```

Props：`page`, `total`, `pageSize`, `disabled`
Events：`update:page`

### Modal

```vue
<ui-Modal v-model:open="showDialog" title="添加成员">
  <template #body>...</template>
  <template #footer>...</template>
</ui-Modal>
```

Props：`open`, `title`, `closable`
Events：`update:open`

### StatusBadge

```vue
<ui-StatusBadge status="pending" />
<ui-StatusBadge status="approved" />
<ui-StatusBadge status="rejected" />
```

Props：`status`（pending/approved/rejected/active/inactive）
内部映射颜色和文字，统一暗色模式。

### Avatar

```vue
<ui-Avatar :src="user.avatar_url" :name="user.name" size="md" />
```

Props：`src`, `name`, `size`（sm/md/lg/xl）, `rounded`（full/default）

### FormInput

```vue
<ui-FormInput v-model="value" label="用户名" placeholder="输入新用户名" />
```

Props：`modelValue`, `label`, `placeholder`, `error`, `disabled`
自动应用品牌色 focus 边框。

### ActionButton

```vue
<ui-ActionButton variant="primary" @click="save">保存</ui-ActionButton>
<ui-ActionButton variant="danger" @click="remove">删除</ui-ActionButton>
<ui-ActionButton variant="ghost">取消</ui-ActionButton>
```

Props：`variant`（primary/danger/warning/ghost/secondary）
自动应用品牌色。

## 六、目录结构

```
src/components/
├── ui/                    # 统一组件库
│   ├── Pagination.vue
│   ├── Modal.vue
│   ├── LoadingSpinner.vue
│   ├── EmptyState.vue
│   ├── StatusBadge.vue
│   ├── FormInput.vue
│   ├── Avatar.vue
│   ├── ActionButton.vue
│   ├── Card.vue
│   ├── Tabs.vue
│   └── index.ts           # 统一导出
├── admin/                 # admin 专属组件（保留）
│   ├── AdminSidebar.vue
│   ├── AdminBottomNav.vue
│   ├── DashboardCard.vue
│   ├── ...
├── dev/                   # dev 专属组件（保留）
│   ├── DevSidebar.vue
│   ├── DevBottomNav.vue
│   └── ...
├── shared/                # 业务共享组件（保留）
│   └── MemberManager.vue
└── ...                    # 其他全局组件
```

## 七、实施步骤

### Step 1：设计 Token 基础设施
- 扩展 `tailwind.config.js`，添加自定义 borderRadius 和 brand 颜色
- 在 `style.css` 中定义 CSS 变量（brand 色系 + 通用 token）
- 在 AdminLayout 和 DevLayout 根元素添加 `data-brand` 属性

### Step 2：Phase 1 组件开发
- 创建 `src/components/ui/` 目录
- 实现 Pagination、Modal、LoadingSpinner、EmptyState 四个组件
- 创建 `index.ts` 统一导出

### Step 3：Phase 1 组件替换
- 分页器：替换 11 个文件中的内联分页器为 `<ui-Pagination>`
- 弹窗：替换 8+ 个文件中的内联弹窗为 `<ui-Modal>`
- 加载状态：替换 10+ 个文件中的内联 spinner 为 `<ui-LoadingSpinner>`
- 空状态：替换 8+ 个文件中的内联空状态为 `<ui-EmptyState>`

### Step 4：Phase 2 组件开发 + 替换
- 实现 StatusBadge、FormInput、Avatar、ActionButton
- 逐步替换各文件中的内联实现

### Step 5：Phase 3 细节完善
- 实现 Card、Tabs 组件
- 抽取 useFormatTime、useStatusMap composables
- 统一 DashboardCard 在 dev 后台的复用
- 统一成员管理 UI 对 MemberManager 的使用

### Step 6：验证 + 清理
- 前端类型检查
- 构建验证
- 删除不再使用的内联样式和重复代码
- 更新 admin 内部不一致的品牌色（ProjectsView 的 blue → emerald）

## 八、风险与注意事项

1. **不要过度抽象**：只抽取真正重复 3 次以上的模式，避免为每个 UI 元素都建组件
2. **渐进替换**：每个 Phase 独立可交付，不搞大爆炸重构
3. **保留 admin/dev 品牌色区分**：通过 CSS 变量 + data-brand 实现，不硬编码
4. **向后兼容**：新组件的 API 要覆盖现有所有用法，不能丢失功能
5. **测试覆盖**：每个新组件应有基本的 props 渲染测试
