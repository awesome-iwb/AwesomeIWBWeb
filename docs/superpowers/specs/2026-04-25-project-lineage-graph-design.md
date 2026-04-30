# Project Lineage Graph Design (Git-like Branch Graph)

## 1. 需求与目标
用户希望在 "Awesome IWB" 平台中，能够直观地看到某些应用之间的“派生”或“Fork”关系（例如：Ink Canvas -> Ink Canvas Plus -> ICA）。
为此，我们需要实现一个类似于 Git 分支图或 GitHub Network 图的可视化组件，帮助用户快速理解软件生态并快捷跳转。

## 2. 数据结构设计 (Data Structure)
在 `/workspace/awesome-iwb/backend/src/data.json` 中的 `projects` 数组里，针对有派生关系的应用增加 `parent` 字段。
*   **字段定义**: `parent: string`
*   **内容**: 被 Fork 或派生的**原始项目的名称**。
*   **示例**:
    ```json
    {
      "name": "Ink Canvas Plus",
      "parent": "Ink Canvas"
    }
    ```

## 3. 组件与核心逻辑设计
### 3.1 `useProjects.ts` 更新
需要在 `Project` 接口中补充可选的 `parent?: string` 字段，以支持 TypeScript 的类型推导。

### 3.2 提取血缘关系逻辑 (Lineage Builder)
在前端（例如 `ProjectDetailView.vue` 或独立的 `LineageGraph.vue` 组件中）：
*   根据当前的 `project.name`，通过 `allProjects` 全局搜索。
*   **向上查找 (Ancestors)**：递归查找 `parent`，直到到达“根节点”（Root）。
*   **向下查找 (Descendants)**：递归查找所有 `parent` 等于当前节点或祖先节点的应用，构建出完整的“树形或图状数据结构”。

### 3.3 视觉表现 (Visual Design)
*   **位置**: 在 `ProjectDetailView.vue` 中，位于“About”与“评论/编辑锐评”之间，或者是右侧 Sidebar，取决于布局空间（推荐在正文区占据横向宽度以展示多节点分支）。
*   **UI 实现**: 
    *   使用 Tailwind CSS 的 Flex/Grid 布局，结合 SVG 连线（或者纯 CSS border/伪元素）来绘制分支关系。
    *   **节点卡片**: 包含应用图标、名称、状态小标签（活跃/停更）。
    *   **高亮**: 当前应用在图谱中需要具有高亮边框和不同的背景色。
    *   **交互**: 鼠标悬停（Hover）会有发光效果，点击（Click）直接通过 `router.push` 跳转到对应的项目详情页，并平滑滚动到顶部。

## 4. 测试与边界情况 (Edge Cases)
1. **找不到项目**: 如果 `parent` 拼写错误或项目被删除，逻辑应该容错，不渲染该分支。
2. **多层级**: 支持 A -> B -> C 的多层嵌套关系。
3. **单节点无分支**: 如果一个项目没有 `parent` 也没有任何衍生项目，该图表区块应该**自动隐藏**（YAGNI）。

## 5. 实施步骤 (Next Steps)
1. 修改 `data.json`，为已知的分支项目（如 Ink Canvas 系列，可能还有随机点名系列）注入 `parent` 数据。
2. 在 `frontend/src/composables/useProjects.ts` 中更新 TypeScript 接口。
3. 创建新的子组件 `ProjectLineageGraph.vue`。
4. 将该组件挂载到 `ProjectDetailView.vue` 中并进行调试样式。
