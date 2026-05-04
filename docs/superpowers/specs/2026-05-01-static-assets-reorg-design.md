# 静态资源规范化（P1：按项目文件夹归档）设计

## 背景与问题

当前仓库的静态资源（logo / banner / icon / avatar / UI 图标等）分散且混用：

- 网站品牌资源、站内 UI 图标、合作方 logo、项目资源混在同一层级目录中。
- 项目资源的命名与归属不清晰，不同项目之间的 logo/banner 混在一起，维护成本高、易误用。
- 项目资源既存在“手工维护路径”（如 `/images/*-icon.*`、`/banner/*`），也存在“下载缓存路径”（`/local_images/...`），缺少统一的 canonical 组织方式。

目标是让资源“可读、可维护、可扩展”，并在迁移时尽量降低对现有页面的影响。

## 目标

1. **明确边界**：brand / ui / partners / projects 的目录分离。
2. **项目资源按项目归档（P1）**：每个项目拥有独立的目录，包含 icon/banner/avatar。
3. **路径稳定与可迁移**：支持渐进迁移，避免一次性大规模破坏引用路径。
4. **约束新增**：避免未来新增资源再次混入旧目录。

非目标（本轮不做）：

- 对所有图片进行重新压缩/重新裁切（可作为后续优化）。
- 完整恢复/重构“生态图谱”等非资源相关功能。

## 目录规范（v1）

所有静态资源统一挂在 `frontend/public/assets/` 下：

- `assets/brand/`
  - 网站品牌资产：站点 icon、字标、PWA/SEO 等使用的品牌资源。
- `assets/ui/`
  - 站内 UI 图标：导航、下载按钮、社交图标等。
- `assets/partners/`
  - 合作/关联组织 logo（例如汇智卓创、Smart Teach）。
- `assets/projects/`（P1）
  - 项目资源按项目归档：
    - `assets/projects/<project-key>/icon.<ext>`
    - `assets/projects/<project-key>/banner.<ext>`
    - `assets/projects/<project-key>/avatar.<ext>`
- `assets/projects-cache/`
  - 仅用于“下载缓存”（可选），不直接被数据引用：
    - `assets/projects-cache/by-url/<md5>.<ext>`

说明：

- `<project-key>` 必须可预测且稳定（详见下文“项目标识生成规则”）。
- canonical 引用路径以 `assets/projects/<project-key>/...` 为准，不再在 `images/` 根目录或 `banner/` 根目录堆放项目资源。

## 项目标识（project-key）生成规则

为了可维护与可追踪，使用以下确定性规则生成 `<project-key>`：

1. 若项目数据存在 `slug` 字段，则使用 `slug`（小写）。
2. 否则若存在 `github_url` 且可解析出 `owner/repo`，则使用：
   - `<owner>-<repo>`（小写），并将非 `[a-z0-9-]` 的字符替换为 `-`，连续 `-` 合并。
3. 否则使用 `name` 做 slugify（同上规则）。

冲突处理：

- 若生成的 key 冲突，则在末尾追加短哈希（例如 `-a1b2c3`）保证唯一。

## 数据与引用规范

### 数据字段

后端返回给前端的 `Project` 字段中：

- `icon` / `banner` / `avatar` 统一使用以 `/assets/projects/...` 开头的路径（或为空字符串）。
- 禁止项目资源继续使用：
  - `/images/*`（除非是明确的 UI/brand/partners）
  - `/banner/*`
  - `/local_images/*`

### 前端引用

前端展示项目卡片/详情页时，优先使用 `Project.icon/banner/avatar` 字段（它们应已是 canonical 路径）。

### 资源类型边界

- `BrandMark.vue` 只引用 `assets/brand/*`。
- `NavBar`、下载按钮、社交入口只引用 `assets/ui/*`。
- `SiteFooter` 的合作方/品牌位只引用 `assets/partners/*` 与 `assets/brand/*`。
- 项目卡片/详情只引用 `assets/projects/*`。

## 迁移策略（分阶段，低风险）

### Phase 0：准备（结构与约束）

- 创建 `frontend/public/assets/{brand,ui,partners,projects,projects-cache}` 目录。
- 增加一个校验脚本（或简单 CI 检查）：
  - 新增项目资源不允许写入 `frontend/public/images` 根目录与 `frontend/public/banner`。
  - 如果发现新增 `*-icon.*`、`*-banner.*` 直接进入旧目录则失败。

### Phase 1：品牌/UI/伙伴资源搬迁（不涉及项目数据）

- 迁移以下资源到新目录，并更新引用：
  - `images/fontlogo/*` → `assets/brand/fontlogo/*`
  - `images/aiwb-icon.*` → `assets/brand/aiwb-icon.*`
  - `images/navigation/*`、`images/download/*` → `assets/ui/...`
  - `hz-logo.png` 等合作方 logo → `assets/partners/...`
- 这部分对数据（`backend/src/data.json`）无影响，改动集中在前端组件引用路径。

### Phase 2：项目资源 canonical 化（核心）

- 扫描 `backend/src/data.json` 中每个项目的 `icon/banner/avatar`：
  - 若为远程 URL：下载到 `assets/projects/<project-key>/<type>.<ext>`（或先落缓存再复制）
  - 若为旧本地路径：
    - `/images/*`、`/banner/*`、`/local_images/*`：复制/迁移到 canonical 目录
- 将 `data.json` 中字段更新为新的 canonical 路径 `/assets/projects/<project-key>/<type>.<ext>`。

兼容策略（可选，建议至少保留一个过渡周期）：

- 对于被迁移走的旧文件（如 `frontend/public/images/*-icon.*`、`frontend/public/banner/*`），保留原文件不删除（或复制一份）以避免外部硬编码链接短期失效。
- 待确认无外部依赖后再清理旧路径。

### Phase 3：下载脚本规范化

当前 `backend/src/download_images.py` 存在硬编码路径（指向旧仓库路径），需要：

- 将 `DATA_FILE` 与 `PUBLIC_DIR` 调整为当前仓库路径（AwesomeIWBWeb）。
- 输出位置改为：
  - 直接写入 canonical：`assets/projects/<project-key>/<type>.<ext>`（推荐）
  - 或写入 cache：`assets/projects-cache/by-url/<md5>.<ext>`，再同步到 canonical
- 并保证脚本幂等（重复运行不会产生大量重复文件）。

## 验证策略

1. 静态检查：
   - 扫描 `backend/src/data.json` 中 `icon/banner/avatar` 是否均为 `/assets/projects/` 或空字符串。
   - 扫描 `frontend/src` 中品牌/UI/伙伴引用是否落在 `assets/{brand,ui,partners}`。
2. 运行验证：
   - `frontend`：`bun test`、`bun run dev` 打开首页与详情页确认图片可加载。
   - `backend`：已有测试通过即可；必要时增加一个简单脚本对 `data.json` 资源路径做断言。

## 回滚策略

- Phase 1/2 迁移以“新增目录 + 更新引用”为主，旧目录在过渡期保留文件，因此回滚只需恢复引用与数据字段即可。

## 交付物清单（实现阶段）

- 新目录结构：`frontend/public/assets/...`
- 前端引用更新：BrandMark/SiteFooter/NavBar 相关资源路径
- 项目资源迁移与 `backend/src/data.json` 更新（canonical 路径）
- `download_images.py` 路径修复与输出规范化
- 校验脚本（CI 或本地脚本）防止回归

