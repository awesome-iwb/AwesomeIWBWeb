# 飞书 Base（ASS 导出）全量同步 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从 `docs/ainnnnnnnnnnn.ass`（飞书 Base 导出快照）全量同步应用数据：项目库更新、表格外项目标记“不活跃”、审核状态同步到审核队列，并在前端新增“组织胶囊”展示。

**Architecture:** 在 backend 侧新增一个“同步脚本 + 可复用的解析/映射模块”，用于离线读取 ASS → 生成规范化项目/提交数据 → 更新 file-mode 数据文件（runtime/data.json、runtime/submissions.json）。前端在项目卡片与详情页新增组织胶囊，组织值来自项目字段 `organization`（优先）或 `extra.feishu.organization`（兼容）。

**Tech Stack:** Bun + TypeScript（backend）、Elysia（API）、Vue 3 + Vite SSG（frontend）

---

## Files To Touch

**Backend**
- Create: `backend/src/feishu/baseSnapshot.ts`
- Create: `backend/src/feishu/sync.ts`
- Create: `backend/src/feishu/sync.test.ts`
- Create: `backend/src/scripts/sync-feishu-base.ts`
- Modify: `backend/package.json` (add script)
- Modify: `backend/src/index.ts` (optional: add admin endpoint to trigger sync; gated behind dbEnabled=false)

**Frontend**
- Modify: `frontend/src/composables/useProjects.ts`（Project 类型新增 organization）
- Modify: `frontend/src/views/ProjectDetailView.vue`（作者旁新增组织胶囊）
- Modify: `frontend/src/views/HomeView.vue`（项目卡片新增组织胶囊）
- Modify: `frontend/src/components/ProjectPreviewOverlay.vue`（预览层新增组织胶囊）
- Modify: `frontend/src/views/CompareView.vue`（对比页新增组织胶囊）

---

### Task 1: 抽取可复用的 ASS/Base 快照解析模块（TDD）

**Files:**
- Create: `backend/src/feishu/baseSnapshot.ts`
- Test: `backend/src/feishu/sync.test.ts`

- [ ] **Step 1: 写 failing test：能解出 fieldMap/recordMap 并读到 37 条记录**

```ts
import { describe, expect, test } from "bun:test";
import fs from "fs";
import path from "path";
import { decodeAssSnapshot, extractTableSnapshot } from "./baseSnapshot";

const fixturePath = path.resolve(__dirname, "../../../docs/ainnnnnnnnnnn.ass");

describe("feishu base snapshot", () => {
  test("decodes gzipSnapshot and extracts table+recordMap", () => {
    const ass = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));
    const snapshot = decodeAssSnapshot(ass);
    const { fieldMap, recordMap } = extractTableSnapshot(snapshot);
    expect(Object.keys(fieldMap).length).toBeGreaterThan(10);
    expect(Object.keys(recordMap).length).toBe(37);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && bun test src/feishu/sync.test.ts`  
Expected: FAIL（模块未实现）

- [ ] **Step 3: 实现 `decodeAssSnapshot` / `extractTableSnapshot`**

实现要求：
- `decodeAssSnapshot(assJson)`：读取 `gzipSnapshot`，base64 decode + gunzip，JSON.parse 后返回 snapshot 数组
- `extractTableSnapshot(snapshot)`：返回 `{ fieldMap, recordMap, recordMeta, tableMeta }`
- 不依赖硬编码 fieldId，仅由快照结构推导

- [ ] **Step 4: 运行测试确认通过**

Run: `cd backend && bun test src/feishu/sync.test.ts`  
Expected: PASS

- [ ] **Step 5: 补充映射读取函数测试（文本/单选/多选）**

新增测试断言：
- `readTextCell` 能从 `项目名称` 读到字符串
- `readSingleSelectCell` 能从 `审核状态` 读到 “通过/待审核/未通过”
- `readMultiSelectCell` 能从 `语言与技术栈` 读到数组（不要求固定值）

---

### Task 2: 实现同步核心逻辑（项目库更新 + 不活跃标记 + 审核队列同步）

**Files:**
- Create: `backend/src/feishu/sync.ts`
- Test: `backend/src/feishu/sync.test.ts`

- [ ] **Step 1: 写 failing test：表格外项目会被标记为“不活跃”**

```ts
import { syncFeishuSnapshotToFileMode } from "./sync";

test("marks missing projects as inactive", () => {
  const before = { categories: [{ id: "c1", name: "A", description: "", projects: [{ name: "Old", developer: "", github_url: "", description: "", keywords: [], status: "活跃" }] }] };
  const snapshotProjects = [{ name: "New", category: "屏幕批注与白板软件", audit_status: "通过", organization: "" }];
  const result = syncFeishuSnapshotToFileMode({ existingData: before as any, snapshotProjects, submissions: [] });
  const old = result.data.categories[0].projects.find((p: any) => p.name === "Old");
  expect(old.status).toBe("不活跃");
});
```

- [ ] **Step 2: 写 failing test：待审核/未通过生成 submissions，并且不进入公开项目库**

断言：
- `audit_status=待审核` → submissions 里存在 `pending`
- `audit_status=未通过` → submissions 里存在 `rejected`
- 两者都不出现在 `data.categories[].projects`（或按实现约定被标记隐藏）

- [ ] **Step 3: 实现 `syncFeishuSnapshotToFileMode`**

实现要求（严格按 spec）：
- 以项目名称（case-insensitive）作为匹配键进行 upsert
- 分类：完全按飞书“项目类别”创建/复用分类
- 表格外项目：`status = "不活跃"`
- 组织：写入 `project.organization`（空则不写/空字符串均可）
- 审核状态：
  - 通过：进项目库；如已有同名 submission 则置为 `approved`
  - 待审核：进入 submissions（`pending`），项目不公开
  - 未通过：进入 submissions（`rejected`），可把“锐评该项目”写入 review_note（若字段存在）
- 图片字段：本阶段不覆盖现有 avatar/icon/banner
- 返回 `{ data, submissions, stats }`，stats 包括 created/updated/inactivated/submissions_created/submissions_updated

- [ ] **Step 4: 运行测试确认通过**

Run: `cd backend && bun test src/feishu/sync.test.ts`  
Expected: PASS

---

### Task 3: 提供可执行脚本，真正写入 runtime/data.json 与 runtime/submissions.json

**Files:**
- Create: `backend/src/scripts/sync-feishu-base.ts`
- Modify: `backend/package.json`

- [ ] **Step 1: 写脚本：读取 ASS → 读 runtime/data.json/submissions.json → 调用 sync → 原子写回**

关键点：
- 读取路径与 backend 一致：`runtime/data.json`、`runtime/submissions.json`
- 写入策略：先写 `*.tmp` 再 rename 覆盖
- 打印 stats 方便验收

- [ ] **Step 2: 增加 package script**

添加：
- `sync:feishu-base`: `bun run src/scripts/sync-feishu-base.ts`

- [ ] **Step 3: 运行一次 dry-run（不落盘）**

脚本支持：
- `--dry-run`：只输出 stats，不写文件

Run: `cd backend && bun run sync:feishu-base -- --input ../docs/ainnnnnnnnnnn.ass --dry-run`  
Expected: 输出 created/updated/inactivated 等统计

- [ ] **Step 4: 正式运行写入**

Run: `cd backend && bun run sync:feishu-base -- --input ../docs/ainnnnnnnnnnn.ass`  
Expected: runtime 文件更新

---

### Task 4: 前端新增“组织胶囊”（作者胶囊旁）

**Files:**
- Modify: `frontend/src/composables/useProjects.ts`
- Modify: `frontend/src/views/ProjectDetailView.vue`
- Modify: `frontend/src/views/HomeView.vue`
- Modify: `frontend/src/components/ProjectPreviewOverlay.vue`
- Modify: `frontend/src/views/CompareView.vue`

- [ ] **Step 1: 扩展 Project 类型**

在 `Project` interface 里新增：
- `organization?: string;`
- `extra?: any;`（兼容 db 模式/扩展字段）

并在 UI 中读取：
- `const org = project.organization || project.extra?.feishu?.organization || ""`

- [ ] **Step 2: ProjectDetailView 增加组织胶囊**

在作者胶囊旁新增：
- 同样的 rounded-full 样式
- 文案显示 org（无则不渲染）

- [ ] **Step 3: HomeView / ProjectPreviewOverlay / CompareView 同步增加组织胶囊**

保持一致展示，不影响布局溢出：
- 长文本截断（truncate）
- 移动端换行正常

---

### Task 5: 校验与回归

**Backend**
- [ ] Run: `cd backend && bun test`
- [ ] Run: `cd backend && bun run sync:feishu-base -- --input ../docs/ainnnnnnnnnnn.ass --dry-run`

**Frontend**
- [ ] Run: `cd frontend && bun install --frozen-lockfile || npm ci`
- [ ] Run: `cd frontend && bun run build`

**Manual spot-check**
- [ ] 随机抽 3 个项目：校验 organization 显示、分类归属、状态值、不活跃标记
- [ ] 打开审核后台：校验 pending/rejected 项目出现在 submissions 列表

