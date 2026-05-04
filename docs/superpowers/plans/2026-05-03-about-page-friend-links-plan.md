# 关于我们页友情链接区 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 About 页“感谢”下方新增“友情链接”区块，支持单列（一行一个）展示友情链接；先内置“智教联盟”一条，并为未来扩展与本地 Logo 预留字段。

**Architecture:** 将友情链接作为前端本地内容配置（`friendLinks.ts`）导出；AboutView 读取渲染为单列链接行。Logo 当前不展示；后续只要把本地资源路径写入 `logo` 字段并放入 `public/assets/links/` 即可启用展示。

**Tech Stack:** Vue 3 + TypeScript + Tailwind（现有项目栈）

---

## Files To Touch

- Create: `frontend/src/content/friendLinks.ts`
- Modify: `frontend/src/views/AboutView.vue`
- Test: `frontend` build

---

### Task 1: 新增友情链接数据文件

**Files:**
- Create: `frontend/src/content/friendLinks.ts`

- [ ] **Step 1: 写入 FriendLink 类型与默认数据**

```ts
export type FriendLink = {
  key: string;
  name: string;
  href: string;
  description: string;
  logo?: string;
};

export const friendLinks: FriendLink[] = [
  {
    key: "zhijiaolianmeng",
    name: "智教联盟",
    href: "https://forum.smart-teach.cn",
    description: "智教联盟论坛：面向一线电教与教师的交流社区，分享工具、经验与问题解决方案。"
  }
];
```

- [ ] **Step 2: 类型检查**

Run:

```bash
cd frontend
bun run build
```

Expected: build 成功（即使 vite-ssg 输出中有 /api/projects 的日志，也要确保 exit code 为 0）

---

### Task 2: AboutView 增加友情链接区块（单列）

**Files:**
- Modify: `frontend/src/views/AboutView.vue`

- [ ] **Step 1: 引入 friendLinks**

```ts
import { friendLinks } from "../content/friendLinks";
```

- [ ] **Step 2: 增加 section**

位置：紧跟“感谢” section 之后。

布局要求：
- 容器：与其它 section 相同的背景/边框/圆角
- 列表：单列（`flex flex-col gap-4` 或 `grid grid-cols-1 gap-4`）
- 每条：可复用现有卡片样式（border + hover + padding），点击整行跳转新窗口
- Logo：如果未来 `logo` 存在才渲染 `<img>`，否则不显示（当前“智教联盟”不展示 Logo）

- [ ] **Step 3: 验证**

Run:

```bash
cd frontend
bun run build
```

Expected: build exit code 0

手动检查 `/about`：
- “感谢”下方出现“友情链接”
- “智教联盟”占一整行（不是一行两个）
- 点击打开新窗口，指向 `https://forum.smart-teach.cn`

