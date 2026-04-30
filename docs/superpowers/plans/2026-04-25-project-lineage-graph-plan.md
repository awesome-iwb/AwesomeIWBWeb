# Project Lineage Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为应用商店详情页添加类似 Git 的“派生分支/生态图谱”（Lineage Graph），直观展示开源软件间的 Fork 与继承关系。

**Architecture:** 
1. `data.json` 增加 `parent` 字段定义单向父节点。
2. 前端 `useProjects.ts` 补充 `parent?: string` 接口定义，并在组件内根据全局应用列表递归构建树/图结构。
3. `ProjectLineageGraph.vue` 负责利用 TailwindCSS 与 SVG 连线，横向或纵向渲染出带有高亮与交互点击的生态节点图。
4. 将该组件挂载到 `ProjectDetailView.vue`。

**Tech Stack:** Vue 3, Tailwind CSS, Lucide Icons, TypeScript

---

### Task 1: Update Data Structure and TypeScript Interfaces

**Files:**
- Modify: `/workspace/awesome-iwb/backend/src/data.json`
- Modify: `/workspace/awesome-iwb/frontend/src/composables/useProjects.ts`

- [ ] **Step 1: Add `parent` fields in data.json**
  Update the entries for the Ink Canvas family to establish the lineage:
  - "Ink Canvas Plus": add `"parent": "Ink Canvas"`
  - "Ink Canvas Artistry": add `"parent": "Ink Canvas"`
  - "ICC-CE": add `"parent": "Ink Canvas"`
  - "ICC-Re": add `"parent": "ICC-CE"` (or Ink Canvas depending on actual lineage, we will use "Ink Canvas" for simplicity here if exact lineage is unclear, or "ICC-CE" to show depth)

- [ ] **Step 2: Update TypeScript Interface**
  In `/workspace/awesome-iwb/frontend/src/composables/useProjects.ts`, add `parent?: string;` to the `Project` interface.

- [ ] **Step 3: Commit changes**
  `git commit -am "feat: add parent field to data.json and Project interface"`

---

### Task 2: Create ProjectLineageGraph Component

**Files:**
- Create: `/workspace/awesome-iwb/frontend/src/components/ProjectLineageGraph.vue`

- [ ] **Step 1: Scaffold the Component**
  Create the Vue 3 component that takes `currentProjectName` and `allProjects` as props.
  Write a computed property `lineageData` that recursively finds the root ancestor, then collects all descendants from that root to form a tree structure (or simply a flat list grouped by generations).

- [ ] **Step 2: Implement the Graph Layout (Tailwind + SVG)**
  Render the root node, then its children, then their children. Use simple flex/grid or relative positioning. Add SVG lines connecting parents to children.
  Ensure the current project node is highlighted (e.g., green border or glow).

- [ ] **Step 3: Add Interaction**
  Add click handlers to the nodes that emit an event or directly push to the router `router.push({ name: 'project-detail', params: { name: encodeURIComponent(projectName) } })`.

- [ ] **Step 4: Commit changes**
  `git add /workspace/awesome-iwb/frontend/src/components/ProjectLineageGraph.vue`
  `git commit -m "feat: create ProjectLineageGraph component"`

---

### Task 3: Integrate Component into ProjectDetailView

**Files:**
- Modify: `/workspace/awesome-iwb/frontend/src/views/ProjectDetailView.vue`

- [ ] **Step 1: Import and Render**
  Import `ProjectLineageGraph` in `ProjectDetailView.vue`.
  Place it between the "About" section and the "Editor's Note" section.

- [ ] **Step 2: Conditional Rendering**
  Ensure the graph only renders if the `lineageData` has more than 1 node (i.e., it has parents or children). If it's a standalone project, do not render the component.

- [ ] **Step 3: Test and Commit**
  Verify the layout doesn't break and clicks trigger navigation properly.
  `git commit -am "feat: integrate lineage graph into project detail view"`
