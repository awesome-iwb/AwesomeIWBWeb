# 液态玻璃效果开关集成计划

## 目标

在个人中心页面添加"液态玻璃效果"开关，用户可自由开启/关闭。暗色模式下自动禁用液态玻璃效果，不做额外适配。

## 架构

- 使用 LGGC 库的 CSS（内联到项目中，不通过 npm 安装，因为库极小且需要定制暗色模式行为）
- 通过 `data-glass="liquid"` 属性控制全局开关
- 暗色模式下 `data-glass` 属性被移除，液态玻璃自动失效
- 开关状态持久化到 `localStorage.liquidGlass`

## 文件变更

| 文件 | 操作 | 说明 |
|------|------|------|
| `frontend/src/style.css` | 修改 | 添加 LGGC 液态玻璃 CSS（受 `[data-glass="liquid"]` 包裹） |
| `frontend/src/store.ts` | 修改 | 添加 `liquidGlass` 全局状态 |
| `frontend/src/views/MeView.vue` | 修改 | 添加液态玻璃开关 UI |
| `frontend/src/components/NavBar.vue` | 修改 | 暗色模式切换时联动禁用液态玻璃 |
| `frontend/src/views/HomeView.vue` | 修改 | 给目标按钮添加 `btn-glass` class |

---

## Task 1: 在 store.ts 中添加液态玻璃全局状态

**文件:** `frontend/src/store.ts`

- [ ] 在 `globalState` 中添加 `liquidGlass: false` 字段

```typescript
export const globalState = reactive({
  isScrolledPastSearch: false,
  isSearchOpen: false,
  liquidGlass: false
});
```

---

## Task 2: 在 style.css 中添加 LGGC 液态玻璃 CSS

**文件:** `frontend/src/style.css`

- [ ] 在文件末尾添加 LGGC 液态玻璃样式，所有规则包裹在 `[data-glass="liquid"]` 选择器下

关键设计：
- `[data-glass="liquid"]` 在 `<html>` 元素上，只有同时满足 `data-glass="liquid"` 且不是 `.dark` 时才生效
- `.btn-glass` 是应用液态玻璃效果的 class，用于按钮等交互元素
- 暗色模式下 `data-glass` 被移除，所有液态玻璃效果自动消失

```css
/* LGGC Liquid Glass Effect - only active in light mode with user opt-in */
[data-glass="liquid"] .btn-glass {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: 1px double rgba(51, 51, 51, 0.08);
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(2.8px) saturate(160%);
  -webkit-backdrop-filter: blur(2.8px) saturate(160%);
  box-shadow:
    inset 1.5px -1.5px 1px -1px rgba(255, 255, 255, 0.92),
    inset -1.5px 1.5px 1px -1px rgba(255, 255, 255, 0.9),
    inset 0 0 3px rgba(15, 23, 42, 0.35),
    0 16px 32px rgba(15, 23, 42, 0.14);
  overflow: hidden;
  isolation: isolate;
}

[data-glass="liquid"] .btn-glass::before {
  content: "";
  position: absolute;
  pointer-events: none;
  border-radius: inherit;
  top: 35%;
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 16px);
  height: calc(100% - 16px);
  border: 1px double rgba(0, 0, 0, 0.9);
  filter: blur(8px);
}

[data-glass="liquid"] .btn-glass > * {
  position: relative;
  z-index: 1;
}
```

---

## Task 3: 在 MeView.vue 中添加液态玻璃开关

**文件:** `frontend/src/views/MeView.vue`

- [ ] 添加 `Sparkles` 图标导入（来自 lucide-vue-next）
- [ ] 添加 `liquidGlass` ref 和 `toggleLiquidGlass` 方法
- [ ] 在"头像显示偏好"区块下方添加"外观偏好"区块，包含液态玻璃开关
- [ ] 开关在暗色模式下显示为禁用状态并提示"暗色模式下不可用"

开关 UI 结构：

```html
<!-- 外观偏好 -->
<div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-4 space-y-3">
  <div class="text-sm font-semibold text-slate-700 dark:text-slate-200">外观偏好</div>
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-2">
      <Sparkles class="w-4 h-4 text-emerald-500" />
      <span class="text-sm text-slate-700 dark:text-slate-200">液态玻璃效果</span>
    </div>
    <button
      @click="toggleLiquidGlass"
      :disabled="isDark"
      class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0"
      :class="[
        liquidGlass ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700',
        isDark ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      ]"
    >
      <span
        class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm"
        :class="liquidGlass ? 'translate-x-6' : 'translate-x-1'"
      />
    </button>
  </div>
  <p v-if="isDark" class="text-xs text-slate-400 dark:text-slate-500">暗色模式下暂不支持液态玻璃效果</p>
</div>
```

逻辑代码：

```typescript
import { Sparkles } from 'lucide-vue-next';

const isDark = ref(false);
const liquidGlass = ref(false);

const checkDark = () => {
  isDark.value = document.documentElement.classList.contains('dark');
};

const checkLiquidGlass = () => {
  liquidGlass.value = localStorage.getItem('liquidGlass') === 'true';
  if (liquidGlass.value && !isDark.value) {
    document.documentElement.setAttribute('data-glass', 'liquid');
  }
};

const toggleLiquidGlass = () => {
  if (isDark.value) return;
  liquidGlass.value = !liquidGlass.value;
  localStorage.setItem('liquidGlass', String(liquidGlass.value));
  if (liquidGlass.value) {
    document.documentElement.setAttribute('data-glass', 'liquid');
  } else {
    document.documentElement.removeAttribute('data-glass');
  }
};

onMounted(() => {
  checkDark();
  checkLiquidGlass();
});
```

---

## Task 4: 在 NavBar.vue 中联动暗色模式与液态玻璃

**文件:** `frontend/src/components/NavBar.vue`

- [ ] 修改 `toggleDark` 方法：切换到暗色时移除 `data-glass`，切回亮色时恢复

```typescript
const toggleDark = () => {
  isDark.value = !isDark.value;
  if (isDark.value) {
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
    document.documentElement.removeAttribute('data-glass');
  } else {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
    if (localStorage.getItem('liquidGlass') === 'true') {
      document.documentElement.setAttribute('data-glass', 'liquid');
    }
  }
};
```

- [ ] 修改 `checkTheme` 方法：初始化时也要检查液态玻璃状态

```typescript
const checkTheme = () => {
  if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    isDark.value = true;
    document.documentElement.classList.add('dark');
  } else {
    isDark.value = false;
    document.documentElement.classList.remove('dark');
    if (localStorage.getItem('liquidGlass') === 'true') {
      document.documentElement.setAttribute('data-glass', 'liquid');
    }
  }
};
```

---

## Task 5: 给 HomeView.vue 中的目标按钮添加 btn-glass class

**文件:** `frontend/src/views/HomeView.vue`

- [ ] 给手机端搜索按钮添加 `btn-glass` class
- [ ] 给手机端轮播卡片中的"查看"圆形按钮添加 `btn-glass` class
- [ ] 给手机端分类标签按钮添加 `btn-glass` class

具体位置：
1. 第 589 行搜索按钮：`class="w-full flex items-center gap-3 ..."` → 添加 `btn-glass`
2. 第 566 行查看按钮：`class="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500 text-white"` → 添加 `btn-glass`
3. 第 612-637 行分类标签按钮：添加 `btn-glass`

---

## Task 6: 验证

- [ ] 亮色模式下开启液态玻璃开关，确认按钮出现液态玻璃效果
- [ ] 亮色模式下关闭液态玻璃开关，确认效果消失
- [ ] 切换到暗色模式，确认液态玻璃自动消失，开关变为禁用状态
- [ ] 切换回亮色模式，确认之前开启的液态玻璃自动恢复
- [ ] 刷新页面，确认液态玻璃开关状态被持久化
- [ ] 确认液态玻璃效果不影响按钮的点击交互
