# 关于我们页（运营组 / 贡献者 / 感谢）改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将“关于我们”页面拆成三块：运营组（4人，暂空）、贡献者（从仓库 README 的 ALL-CONTRIBUTORS 表格同步）、感谢（2人，暂空），并确保头像等资源全部落在项目本地而不是外链 URL。

**Architecture:** 在 frontend 增加一个“同步脚本”从根目录 `README.md` 解析贡献者列表，并把 GitHub avatar 下载到 `frontend/public/assets/people/contributors/`，同时生成 `contributors.generated.ts` 供 `AboutView` 渲染。运营组与感谢两块先渲染占位卡片（本地 placeholder 图）。

**Tech Stack:** Bun + TypeScript（脚本）、Vue 3（页面）

---

## Files To Touch

**Frontend**
- Create: `frontend/public/assets/people/placeholder.svg`
- Create: `frontend/scripts/sync-contributors.ts`
- Create: `frontend/src/content/contributors.generated.ts` (由脚本生成/覆盖)
- Modify: `frontend/package.json`（新增脚本命令）
- Modify: `frontend/src/views/AboutView.vue`

---

### Task 1: 准备本地 placeholder 头像资源

**Files:**
- Create: `frontend/public/assets/people/placeholder.svg`

- [ ] **Step 1: 添加 placeholder.svg**

内容示例（保证是本地文件引用，不用外链）：

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="32" fill="#CBD5E1"/>
  <path d="M64 68c14 0 24-10 24-24S78 20 64 20 40 30 40 44s10 24 24 24Zm0 12c-20 0-44 10-44 30v8h88v-8c0-20-24-30-44-30Z" fill="#64748B"/>
</svg>
```

- [ ] **Step 2: 手工验证资源路径**

资源 URL 应为：`/assets/people/placeholder.svg`

---

### Task 2: 从 README 解析贡献者名单，并把头像下载到本地（生成 contributors.generated.ts）

**Files:**
- Create: `frontend/scripts/sync-contributors.ts`
- Create (generated): `frontend/src/content/contributors.generated.ts`
- Modify: `frontend/package.json`

- [ ] **Step 1: 新增脚本入口**

在 `frontend/package.json` 增加：

```json
{
  "scripts": {
    "sync:contributors": "bun run scripts/sync-contributors.ts"
  }
}
```

- [ ] **Step 2: 实现 README 解析**

解析目标区间：
- `<!-- ALL-CONTRIBUTORS-LIST:START` 到 `<!-- ALL-CONTRIBUTORS-LIST:END -->`

解析目标字段（从表格 HTML 中提取）：
- profile URL：`<a href="...">`
- avatar URL：`<img src="...">`
- display name：`<sub><b>...</b></sub>`

推荐用正则分段，不引入新依赖：

```ts
const section = readme.slice(startIdx, endIdx);
const cellRe = /<td[\\s\\S]*?<a href="([^"]+)"[\\s\\S]*?<img src="([^"]+)"[\\s\\S]*?<sub><b>([^<]+)<\\/b><\\/sub>/g;
```

并从 profile URL 推导稳定 key（用于文件名）：
- `https://github.com/<username>` → `<username>`
- 非 GitHub 域名（例如个人站）：fallback 用 `encodeURIComponent(name)` 做 key

- [ ] **Step 3: 下载头像到本地 public 目录**

输出目录：
- `frontend/public/assets/people/contributors/`

下载策略：
- 对 avatar URL 去掉 `?` 后面的查询参数，或改成 `?size=128`（可选）
- 通过响应 `content-type` 决定扩展名：
  - `image/png` → `.png`
  - `image/jpeg` → `.jpg`
  - `image/webp` → `.webp`
  - 其它 → `.png`

生成时写入：
- `avatarPath: "/assets/people/contributors/<key>.<ext>"`

如下载失败：
- `avatarPath` 回退为 `/assets/people/placeholder.svg`

- [ ] **Step 4: 生成 contributors.generated.ts**

输出到：
- `frontend/src/content/contributors.generated.ts`

内容形态（必须是本地 avatarPath，不允许外链）：

```ts
export type Contributor = {
  key: string;
  name: string;
  href: string;
  avatar: string;
};

export const contributors: Contributor[] = [
  { key: "LiPolymer", name: "LiPolymer", href: "http://lipoly.ink", avatar: "/assets/people/contributors/LiPolymer.png" }
];
```

- [ ] **Step 5: 运行脚本并检查产物**

Run:

```bash
cd frontend
bun run sync:contributors
```

Expected:
- `frontend/public/assets/people/contributors/` 下出现若干头像文件
- `frontend/src/content/contributors.generated.ts` 更新

---

### Task 3: 改造 AboutView 为三段式布局（运营组 / 贡献者 / 感谢）

**Files:**
- Modify: `frontend/src/views/AboutView.vue`

- [ ] **Step 1: AboutView 引入 contributors.generated**

```ts
import { contributors } from "../content/contributors.generated";
```

- [ ] **Step 2: 增加运营组与感谢占位数据**

运营组：固定 4 个空卡位  
感谢：固定 2 个空卡位  
卡片字段统一：
- name（空时显示“待加入”）
- role（空时显示“”或“”）
- avatar（统一 placeholder）

- [ ] **Step 3: 模板结构**

页面三段顺序：
1. 运营组（grid 4）
2. 贡献者（grid 自适应，数据来自 contributors）
3. 感谢（grid 2）

所有头像：
- 运营组/感谢：`/assets/people/placeholder.svg`
- 贡献者：`contributors.generated.ts` 提供的本地路径

---

### Task 4: 验证

- [ ] **Step 1: 同步贡献者 + 前端类型检查 + 构建**

Run:

```bash
cd frontend
bun run sync:contributors
bun run build
```

Expected: build 成功

- [ ] **Step 2: 本地 dev 验证**

Run:

```bash
cd frontend
bun run dev -- --host 0.0.0.0 --port 5173
```

打开 `/about` 检查：
- 运营组 4 个占位卡
- 贡献者列表为 README 里的名单（头像为本地文件路径）
- 感谢 2 个占位卡

