# 标签系统改革（普通标签 vs 技术栈）设计文档

## 背景与问题

项目详情页右侧目前有两类标签展示：
- **Tags（普通标签）**：渲染 `project.keywords`
- **Tech Stack（技术栈）**：仅渲染 `project.language`（单值）

当前后端同步/导入逻辑会把飞书的“语言与技术栈”多选字段（`tech_stack`）与“项目状态”等普通标签（`project_state_tags`）合并到同一个 `keywords` 数组中，导致诸如 `Avalonia` 这类技术栈被显示在 **Tags** 区块里，出现标签错位。

## 目标

1. **技术栈标签只出现在 Tech Stack 区块**，不再混入 Tags。
2. **普通标签（例如项目状态、推荐等）只出现在 Tags 区块**。
3. 兼容已有数据：即使运行时 JSON/DB 里历史 `keywords` 已混入技术栈，也能在 API 返回时“纠正”展示。

## 数据契约（Project JSON）

- `project.keywords`: `string[]`，仅普通标签（非技术栈）
- `project.extra.feishu.tech_stack`: `string[]`，技术栈标签（多选）
- `project.language`: `string`，单值语言（用于首页筛选/概览；可从 `tech_stack` 推导）

## 改动范围

### 后端（数据生产 + API 兼容清洗）

1) **停止合并**：在飞书同步（或导入）时，不再把 `tech_stack` 合并进 `keywords`，仅把普通标签写入 `keywords`，同时保留：
- `extra.feishu.tech_stack`
- `extra.feishu.project_state_tags`

2) **兼容清洗**：在 API 返回项目数据时：
- 若存在 `extra.feishu.tech_stack`，则从 `keywords` 中移除与其重复的条目（避免历史数据导致的错位）。

### 前端（详情页展示）

1) Tags 区块保持渲染 `project.keywords`（此时应该已是“普通标签”）
2) Tech Stack 区块改为优先渲染 `project.extra.feishu.tech_stack`（数组，展示多个标签）
3) 若 `tech_stack` 为空，则回退显示 `project.language`（单值）

## 验证标准

- 任意项目（例如包含 `Avalonia`）：
  - `Avalonia` 出现在 Tech Stack 区块
  - Tags 区块不再出现 `Avalonia`
- 首页、搜索、命令面板等依赖 `keywords` 的模块不会再被技术栈污染（`keywords` 仅保留普通标签）
- `frontend` 与 `backend` 构建/启动通过

