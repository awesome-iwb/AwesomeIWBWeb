# 项目卡片悬停预览面板 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在首页项目卡片上实现“悬停 5 秒 → 3D Touch 风格预览面板（有 banner 才弹层）/ 无 banner 进入放大态”的交互，并在移动端支持长按触发。

**Architecture:** 把“计时/触发/取消/状态机”抽成纯函数（可测试），HomeView 只负责事件绑定与状态驱动；预览面板用 Teleport 到 body 的 overlay 组件以避免被卡片容器裁剪。

**Tech Stack:** Vue 3 + Vite + Tailwind；测试使用 bun test（前端 TS 直接跑）。

---

## 文件结构

**新增**
- `frontend/src/utils/projectPreview.ts`：悬停/长按状态机与时间阈值判定（纯函数）
- `frontend/src/utils/projectPreview.test.ts`：状态机测试（bun test）
- `frontend/src/components/ProjectPreviewOverlay.vue`：Teleport overlay 预览面板（banner 全图 + 3D 动画 + 定位）

**修改**
- `frontend/package.json`：补一个 `test` 脚本（`bun test`）
- `frontend/src/views/HomeView.vue`：在卡片上接入 hover/longpress 逻辑；无 banner 进入 zoom；有 banner 进入 panel 并传入 rect

---

### Task 1: 增加前端测试入口（RED）

**Files:**
- Modify: [package.json](file:///workspace/awesome-iwb/frontend/package.json)

- [ ] **Step 1: 添加 test script**

将 scripts 增加一行：

```json
{
  "scripts": {
    "test": "bun test"
  }
}
```

- [ ] **Step 2: 运行测试命令（此时应为 0 tests 或失败，取决于是否已有测试文件）**

Run:

```bash
cd /workspace/awesome-iwb/frontend && bun run test
```

Expected:
- 如果没有测试文件：bun 输出 “0 pass / 0 fail” 也可接受
- 如果有测试文件：按其现状通过

---

### Task 2: 状态机纯函数 + 单测（TDD）

**Files:**
- Create: [projectPreview.test.ts](file:///workspace/awesome-iwb/frontend/src/utils/projectPreview.test.ts)
- Create: [projectPreview.ts](file:///workspace/awesome-iwb/frontend/src/utils/projectPreview.ts)

- [ ] **Step 1: 写失败测试（RED）**

```ts
import { describe, expect, test } from "bun:test";
import { shouldOpenPanel, shouldEnterZoom, clampOverlayPosition } from "./projectPreview";

describe("project preview", () => {
  test("shouldEnterZoom: desktop hover enters zoom immediately", () => {
    expect(shouldEnterZoom({ mode: "desktop", elapsedMs: 0 })).toBe(true);
  });

  test("shouldOpenPanel: desktop hover opens panel only after 5000ms", () => {
    expect(shouldOpenPanel({ mode: "desktop", elapsedMs: 4999, hasBanner: true })).toBe(false);
    expect(shouldOpenPanel({ mode: "desktop", elapsedMs: 5000, hasBanner: true })).toBe(true);
  });

  test("shouldOpenPanel: no banner never opens panel", () => {
    expect(shouldOpenPanel({ mode: "desktop", elapsedMs: 99999, hasBanner: false })).toBe(false);
  });

  test("clampOverlayPosition: never offscreen", () => {
    const pos = clampOverlayPosition({
      cardRect: { left: 10, top: 10, width: 200, height: 120 },
      viewport: { width: 320, height: 480 },
      overlaySize: { width: 360, height: 240 }
    });
    expect(pos.left).toBeGreaterThanOrEqual(8);
    expect(pos.top).toBeGreaterThanOrEqual(8);
  });
});
```

- [ ] **Step 2: 运行测试确认失败（Verify RED）**

Run:

```bash
cd /workspace/awesome-iwb/frontend && bun run test
```

Expected:
- FAIL：找不到 `projectPreview` 或导出函数不存在

- [ ] **Step 3: 写最小实现（GREEN）**

```ts
export type PreviewMode = "desktop" | "touch";

export function shouldEnterZoom(input: { mode: PreviewMode; elapsedMs: number }) {
  return input.mode === "desktop" ? true : input.elapsedMs >= 700;
}

export function shouldOpenPanel(input: { mode: PreviewMode; elapsedMs: number; hasBanner: boolean }) {
  if (!input.hasBanner) return false;
  return input.mode === "desktop" ? input.elapsedMs >= 5000 : input.elapsedMs >= 700;
}

export function clampOverlayPosition(input: {
  cardRect: { left: number; top: number; width: number; height: number };
  viewport: { width: number; height: number };
  overlaySize: { width: number; height: number };
  padding?: number;
}) {
  const padding = input.padding ?? 8;
  const preferTop = input.cardRect.top >= input.overlaySize.height + padding;
  const rawTop = preferTop
    ? input.cardRect.top - input.overlaySize.height - padding
    : input.cardRect.top + input.cardRect.height + padding;

  const rawLeft = input.cardRect.left + input.cardRect.width / 2 - input.overlaySize.width / 2;

  const left = Math.min(
    input.viewport.width - input.overlaySize.width - padding,
    Math.max(padding, rawLeft)
  );
  const top = Math.min(
    input.viewport.height - input.overlaySize.height - padding,
    Math.max(padding, rawTop)
  );

  return { left, top, placement: preferTop ? "top" : "bottom" as const };
}
```

- [ ] **Step 4: 运行测试确认通过（Verify GREEN）**

Run:

```bash
cd /workspace/awesome-iwb/frontend && bun run test
```

Expected: PASS

---

### Task 3: 新增 Teleport Overlay 组件（ProjectPreviewOverlay）

**Files:**
- Create: [ProjectPreviewOverlay.vue](file:///workspace/awesome-iwb/frontend/src/components/ProjectPreviewOverlay.vue)
- Modify: [HomeView.vue](file:///workspace/awesome-iwb/frontend/src/views/HomeView.vue)

- [ ] **Step 1: 写最小 overlay 组件（先不接入 HomeView）**

组件要求：
- `Teleport to="body"`
- 接收 props：`project`、`cardRect`、`visible`
- `visible=false` 时不渲染
- 渐变遮罩 + banner 全图 + 标题/开发者
- 点击遮罩 emit `close`
- `Escape` emit `close`

- [ ] **Step 2: 在 HomeView 里临时硬编码入口，确认可显示/可关闭**

Run:

```bash
cd /workspace/awesome-iwb/frontend && bun run dev -- --host 0.0.0.0 --port 5173
```

Expected:
- 任意方式触发 overlay 后可见；点击遮罩关闭；Esc 关闭（桌面）

---

### Task 4: HomeView 接入 hover 5 秒与 zoom/panel 状态

**Files:**
- Modify: [HomeView.vue](file:///workspace/awesome-iwb/frontend/src/views/HomeView.vue)

- [ ] **Step 1: 为每张卡片增加 ref 与 pointer 事件**

事件：
- `pointerenter`：进入 zoom + 启动 5 秒定时
- `pointerleave`：取消定时 + 回到 idle（并关闭 overlay）
- `pointerdown`：取消定时（避免用户点击时误弹）

- [ ] **Step 2: 在无 banner 情况下，只应用 zoom UI（图标/标题放大，描述与睿评完整展开）**

实现要点：
- 用状态 `zoomProjectName` 控制当前卡片是否 zoom
- 描述与睿评：zoom 时移除 line-clamp/truncate
- 卡片允许自然增高（不做内部滚动）

- [ ] **Step 3: 在有 banner 且悬停满 5 秒时打开 overlay**

实现要点：
- 取卡片 `getBoundingClientRect()`
- 通过 `clampOverlayPosition` 计算 left/top
- overlay 关闭时回到 zoom（仍在悬停）或 idle（已离开）

- [ ] **Step 4: 加入滚动取消**

实现要点：
- `window.addEventListener("scroll", ...)` 取消预览与 timer（capture=true）
- 如有内部滚动容器（main），也可在其上加 scroll 监听（可先只做 window）

- [ ] **Step 5: 手动回归**

Checklist：
- 悬停 <5 秒离开：不出现 overlay
- 悬停 5 秒且有 banner：出现 overlay
- 悬停 5 秒但无 banner：不出现 overlay，只 zoom 并展开描述/睿评
- 滚动时：取消 zoom/overlay
- 点击卡片：正常进入详情页，不会在按下时突然弹 overlay

---

### Task 5: 移动端长按 700ms 接入（touch）

**Files:**
- Modify: [HomeView.vue](file:///workspace/awesome-iwb/frontend/src/views/HomeView.vue)

- [ ] **Step 1: pointerdown(touch) 启动 700ms 定时，pointerup/cancel 取消**
- [ ] **Step 2: 增加移动阈值（10px）避免滚动误触发**
- [ ] **Step 3: 触发后同桌面逻辑：有 banner → overlay，无 banner → zoom**
- [ ] **Step 4: 手动回归**

Checklist：
- 长按 700ms 触发
- 手指滑动/滚动不会触发
- 点击轻触仍然进入详情页（不变）

---

## Plan 自检（覆盖 spec）

- 悬停 5 秒触发：Task 4
- 有 banner 弹层：Task 4 + Task 3
- 无 banner 放大态：Task 4 Step 2
- 描述与睿评完整展开：Task 4 Step 2
- 移动端长按：Task 5
- 定位不出屏：Task 2 clampOverlayPosition + Task 4 Step 3
