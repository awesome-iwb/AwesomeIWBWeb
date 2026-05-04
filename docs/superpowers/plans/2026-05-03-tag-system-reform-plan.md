# 标签系统改革（普通标签 vs 技术栈）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让项目详情页及全站正确区分普通标签（Tags）与技术栈（Tech Stack），避免技术栈标签混入普通标签。

**Architecture:** 后端在“数据生产”阶段停止把 `tech_stack` 合并进 `keywords`，并在 API 返回阶段对历史数据做兼容清洗（从 `keywords` 移除 `extra.feishu.tech_stack` 的重叠项）。前端详情页改为用 `extra.feishu.tech_stack` 渲染 Tech Stack（多标签），Tags 继续渲染 `keywords`。

**Tech Stack:** Bun + Elysia（后端）、Vue 3 + TypeScript（前端）

---

## Files To Touch

- Modify: `backend/src/feishu/sync.ts`
- Modify: `backend/src/scripts/import-feishu-base.ts`
- Modify: `backend/src/services/projects.ts`
- Modify: `frontend/src/views/ProjectDetailView.vue`
- Test: `frontend` build、`backend` bun test（如存在）

---

### Task 1: 后端数据生产停止合并 tech_stack → keywords

**Files:**
- Modify: `backend/src/feishu/sync.ts`
- Modify: `backend/src/scripts/import-feishu-base.ts`

- [ ] **Step 1: sync.ts 中 keywords 只保留普通标签**

将当前 `keywords = [...tech, ...stateTags]` 的合并逻辑改为仅保留 `stateTags`（或其它明确的普通标签集合），并确保 `extra.feishu.tech_stack` 仍保存原始技术栈数组。

- [ ] **Step 2: import-feishu-base.ts 中 keywords 只保留普通标签**

将：

```ts
const keywords = Array.from(new Set([...techs, ...stateTags])).filter(Boolean);
```

改为：

```ts
const keywords = Array.from(new Set(stateTags)).filter(Boolean);
```

并保留：

```ts
extra: { feishu: { tech_stack: techs, project_state_tags: stateTags } }
```

---

### Task 2: API 返回阶段兼容清洗（历史数据不改也能正确展示）

**Files:**
- Modify: `backend/src/services/projects.ts`

- [ ] **Step 1: 为项目输出增加 normalize：keywords 去除 tech_stack 重叠**

实现一个小函数：

```ts
function normalizeTags(p: any) {
  const tech = Array.isArray(p?.extra?.feishu?.tech_stack) ? p.extra.feishu.tech_stack : [];
  const techSet = new Set(tech.map((x: any) => String(x).trim()).filter(Boolean));
  const keywords = Array.isArray(p?.keywords) ? p.keywords : [];
  const cleanKeywords = keywords
    .map((x: any) => String(x).trim())
    .filter(Boolean)
    .filter((x: string) => !techSet.has(x));
  return { ...p, keywords: cleanKeywords };
}
```

然后在 `list/get` 的返回路径里，对每个项目调用 `normalizeTags` 再返回。

---

### Task 3: 前端详情页 Tech Stack 改为渲染 tech_stack 数组

**Files:**
- Modify: `frontend/src/views/ProjectDetailView.vue`

- [ ] **Step 1: 增加 techStack 计算值**

```ts
const techStack = computed(() => {
  const tech = project.value?.extra?.feishu?.tech_stack;
  if (Array.isArray(tech) && tech.length) return tech;
  return project.value?.language ? [project.value.language] : [];
});
```

- [ ] **Step 2: 模板渲染 Tech Stack 为多标签**

将原先只显示 `project.language` 的区块改为 `v-for="t in techStack"` 形式，样式复用现有 tag chip。

---

### Task 4: 验证

**Files:**
- Test: build

- [ ] **Step 1: 前端构建**

Run:

```bash
cd frontend
bun run build
```

Expected: exit code 0

- [ ] **Step 2: 后端测试（如存在）**

Run:

```bash
cd backend
bun test
```

Expected: exit code 0（若仓库无测试则跳过，以启动无报错为准）

- [ ] **Step 3: 手动核对一个含 Avalonia 的项目**

打开该项目详情页：
- Tags 区块不出现 Avalonia
- Tech Stack 区块出现 Avalonia

