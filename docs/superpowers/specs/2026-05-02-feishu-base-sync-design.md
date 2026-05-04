# 飞书 Base（ASS 导出）→ 应用数据库全量同步设计

## 背景与目标

当前飞书 Base 是项目数据的真源。你已将 Base 导出的文件重命名为 `docs/ainnnnnnnnnnn.ass`（实际内容为 JSON，其中 `gzipSnapshot` 为 base64+gzip 的快照）。

本次目标是在不依赖飞书在线访问与下载的前提下，基于该 ASS 快照：

- 全量同步项目清单：新增/更新项目、分类、技术栈等信息
- 同步审核状态到“运维审核系统”（待审核/未通过进入审核队列）
- 对“不在表格里的旧项目”统一标记为“不活跃”
- 增加“组织胶囊”：在作者胶囊旁新增组织胶囊（先文字，组织图标后补）
- 图片资源（logo/banner/素材）后续单独补齐；当前阶段不覆盖现有静态资源路径

## 输入与解析

### 输入文件

- `docs/ainnnnnnnnnnn.ass`
  - JSON
  - `gzipSnapshot`: base64+gzip
  - 解压后为 Base 快照 JSON，包含：
    - `table.fieldMap`：字段定义（中文列名、字段类型、选项表等）
    - `recordMap`：37 条记录（key 为 recordId，value 为 { fldXxx: cellValue }）

### 关键字段（列）

以列名为准进行映射，主要使用：

- 项目唯一键：`项目名称`
- 分类：`项目类别`（单选）
- 审核状态：`审核状态`（单选：通过/未通过/待审核）
- 组织：`是否为其他组织旗下产品（不是就不填）`（文本，空则无组织胶囊）
- 其它信息：
  - `开发者`
  - `开发者GitHub账号`
  - `项目地址`
  - `项目官网`
  - `项目简单介绍`
  - `语言与技术栈`（多选）
  - `项目状态`（多选，用于生成 recommendation/标签）
  - `项目AI含量是否超过50%`（单选：是/否 → ai_usage_state）

### 输出中间产物

新增脚本（已在 backend 中实现）将 ASS 转为可导入 JSON：

- `backend/src/scripts/import-feishu-base.ts`
  - 输入：ASS 文件路径
  - 输出：`{ categories: [{ name, description, projects: [...] }] }`
  - 当前阶段：只输出“飞书表格里的 37 条项目”，不做“不活跃”更新（不活跃在后续同步步骤中实现）

## 数据同步规则

### 1) 分类策略（用户确认：完全按飞书新建分类）

飞书“项目类别”的 6 个选项，全部作为站点分类存在：

- 运维类软件与项目
- 体验优化类软件与工具
- 其他（填写该选项需留下联系方式，以便我们进一步确认）
- 活动辅助软件与工具
- 信息展示与看板类软件
- 屏幕批注与白板软件

处理细节：

- 对选项名做 trim（去掉首尾空白与换行），但不改文案
- 若站点现有 `data.json` 中不存在同名分类，则创建新分类（id 随机 8 位）
- 若已存在同名分类，则复用其 id

### 2) 项目 upsert（全量同步）

以 `项目名称`（忽略大小写）作为匹配键：

- 表格里存在：
  - 若站点已有同名项目：更新字段（见“字段映射”）
  - 若站点不存在：新增到对应分类
- 表格里不存在（站点旧项目）：将 `status` 更新为 `不活跃`

注意：

- 本阶段不覆盖 `avatar/icon/banner`（除非你后续提供组织/项目图标资源映射）
- 不删除项目，只标记状态

### 3) 审核系统同步

飞书 `审核状态` 同步到审核队列：

- `待审核`：
  - 进入 project_submissions（或 file-mode 的 submissions.json）状态 `pending`
  - 不进入公开项目库（或进入但标记为不活跃/隐藏，取决于现有前端筛选逻辑；优先按“仅通过才公开”实现）
- `未通过`：
  - 进入 project_submissions 状态 `rejected`
  - 可将 `锐评该项目` 作为 review_note 或放入 payload.extra 供后台查看
- `通过`：
  - 进入/更新项目库
  - 同时可将对应 submission 标记为 `approved`（若存在）

### 4) 组织胶囊

数据层新增字段（推荐为显式字段，便于前端展示）：

- `organization: string`（空字符串或 undefined 表示无组织）

来源：

- 飞书列 `是否为其他组织旗下产品（不是就不填）`

前端展示：

- 在“作者胶囊（头像+作者名）”旁增加一个“组织胶囊（文本）”
- 组织图标资源后续再补（可扩展字段：`organization_icon` 或放入 `extra.organization`）

### 5) 字段映射（项目库）

将飞书字段映射为项目对象字段（以现有 schema 为准）：

- `name` ← 项目名称
- `developer` ← 开发者
- `github_url` ← 项目地址（Url）
- `description` ← 项目简单介绍
- `keywords` ← 语言与技术栈 + 项目状态（去重）
- `ai_usage_state` ← 项目AI含量是否超过50%
  - 是 → over50
  - 否 → under50
  - 空/异常 → unknown
- `language` ← 从“语言与技术栈”中推断（如 TypeScript/Java/C#/Python…，缺失则空）
- `status`：
  - 表格内项目默认 `活跃`（除非你后续给出更细规则）
  - 表格外项目强制 `不活跃`
- `recommendation`：
  - 从“项目状态”多选推断（例如 值得推荐/稳定/不稳定/画饼/薛定谔的猫 → 映射为现有徽章文案）

其余字段（stars/version/releases/图片路径）：

- 默认保留原值（尤其是 assets 路径与 GitHub 统计数据），避免被表格空值覆盖

## 失败与回滚策略

- 同步执行前输出 diff 统计：新增/更新/标记不活跃/提交队列变更数量
- file-mode（无 DB）下：
  - 对 `backend/src/data.json`、`backend/src/submissions.json` 采用“写入临时文件 → 原子替换”策略
  - 写入前备份一份到 `backend/runtime/revisions.json`（或现有 revisions 机制）

## 验证

- 后端：跑 bun test（domain 层测试至少通过）
- 前端：本地拉起后检查项目详情页作者区域是否正确显示两个胶囊
- 数据：随机抽样 3 个项目，核对：
  - 分类正确
  - organization 正确显示/隐藏
  - 不在表格里的旧项目 status=不活跃

