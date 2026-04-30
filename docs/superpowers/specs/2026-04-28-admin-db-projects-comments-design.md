# Awesome IWB 重构设计：PostgreSQL 项目库真源 + 后台编辑器 + 自研讨论/Bug（Phase 1-3）

日期：2026-04-28  
范围：以“项目库数据化/模板化 + 后台可运营”为核心，先落地 Phase 1（项目库 DB 真源 + 后台编辑器 + JSON/CSV 导入导出），为后续 Phase 2（智教联盟登录）与 Phase 3（自研讨论/Bug）打底。  

## 0. 背景与目标

### 0.1 现状问题
- 前端仍存在构建期静态数据源（例如直接 import data.json），导致后台修改无法稳定驱动前台展示。
- 后台具备“演示级”编辑能力，但缺少重场景必需能力：并发一致性、审计、筛选/分页/排序、导入导出、权限边界。
- 未来将引入自研讨论/Bug 反馈、开发者绑定、管理员治理，写入频率与治理复杂度上升，文件型真源会迅速暴露并发与审计短板。

### 0.2 总目标
- 项目库（分类/项目）以 PostgreSQL 为真源，前台与后台统一走 API。
- 后台演进为“可视化编辑器式控制台”，解决“数据库不方便查询/编辑”的顾虑。
- 支持项目数据 JSON + CSV 的导入导出。
- 保持项目稳定标识：`projectId/slug` 创建后不自动变化（改名不影响链接与挂载）。
- 后续引入：智教联盟 OIDC 登录（唯一入口）+ 本地用户体系（可绑定多 provider）、自研讨论/Bug（两类线程）。

## 1. 范围划分（分期）

### Phase 1（本次必须落地）
- PostgreSQL（Docker Compose）引入
- DB schema + migration runner（最小实现）
- 项目库导入（从现有 data.json 导入）
- API：projects/categories 读写（写接口先预留鉴权挂点）
- 后台：项目库编辑器式页面（手动保存）
- 导入导出：JSON/CSV（CSV “来什么列导什么列”，支持字段别名）
- 前端：移除对本地 data.json 的 import 真源，全部改为请求 API

### Phase 2（紧随其后）
- 智教联盟 OIDC/OAuth2 登录接入
- 本地 user + identity 存储（provider 可扩展）
- 管理员/开发者绑定由本后台负责（不依赖联盟角色）
- 后台写接口鉴权（cookie session）

### Phase 3（紧随其后）
- 自研讨论系统（discussion）+ Bug 反馈系统（bug）
- 全站通用挂载目标 target（先支持 project / todayArticle，schema 可扩展）
- Bug 工单化（状态/严重程度/指派/审计/通知）

## 2. 数据模型（Phase 1）

### 2.1 categories
- id: uuid PK
- name: text not null
- description: text default ''
- sort_index: int default 0
- created_at / updated_at: timestamptz

### 2.2 projects
- id: uuid PK
- slug: text unique not null
- name: text not null
- category_id: uuid FK(categories.id)
- developer: text default ''
- description: text default ''
- keywords: text[] default '{}'
- recommendation: text[] default '{}'
- github_url: text default ''
- icon: text default ''
- banner: text default ''
- stars: int default 0
- language: text default ''
- last_update: timestamptz null
- created_at / updated_at: timestamptz

### 2.3 slug 生成规则（用户已确认）
- 采用“方案 B”：uuid/短 hash 类稳定标识，不依赖 name。
- slug 创建后不自动随 name 变化（避免链接与评论挂载失效）。

## 3. 数据导入/导出（Phase 1）

### 3.1 初始导入：data.json -> DB
- 一次性导入 categories/projects
- 对每个 project 生成 slug（短 hash/uuid），写入 DB
- 记录导入日志（至少输出统计：导入项目数、重复处理数）

### 3.2 导出
- JSON：全量导出，适合备份/迁移
- CSV：面向运营/表格编辑，列可选择全量或常用子集；导出时默认输出“常用列 + 关键列（slug）”

### 3.3 导入（用户已确认：方案 C）
导入时匹配策略：
- 优先用 slug 匹配更新
- slug 不存在时，再用 name 匹配更新
- 若两者都无法匹配，则新增

CSV 导入规则（“来什么列导什么列”）：
- 支持列名别名映射（如 name/项目名/名称）
- 未提供字段保持默认值或保留原值（更新时）
- 多余列忽略
- keywords/recommendation：
  - 若输入为逗号分隔字符串，导入时 split 为数组
  - 若输入为 JSON 数组字符串，也支持解析（可选）

冲突与安全：
- 若 name 匹配到多个项目（理论上不应发生，但需防御），进入“拒绝导入/要求提供 slug”策略。

## 4. API 设计（Phase 1）

### 4.1 公共读接口（前台使用）
- GET /api/categories
- GET /api/projects
  - query:
    - q: string（全文/名称/关键词）
    - category: categoryId 或 categorySlug（Phase 1 先用 id）
    - sort: stars|updated|name
    - page/pageSize
- GET /api/projects/:slug

### 4.2 管理写接口（后台使用）
Phase 1 先实现，Phase 2 加鉴权中间件（session）：
- POST /api/admin/categories
- PUT /api/admin/categories/:id
- DELETE /api/admin/categories/:id
- POST /api/admin/projects
- PUT /api/admin/projects/:id
- DELETE /api/admin/projects/:id

### 4.3 导入导出
- GET /api/admin/projects/export.json
- GET /api/admin/projects/export.csv
- POST /api/admin/projects/import.json
- POST /api/admin/projects/import.csv

## 5. 前端重构（Phase 1）

目标：全站项目数据只来自 API。

### 5.1 替换静态数据源
- 移除类似 useProjects composable 中对本地 data.json 的 import 真源，改为 fetch /api/projects + /api/categories。

### 5.2 页面范围
- 首页项目列表
- 项目详情页
- 对比页
- 搜索/命令面板（如依赖项目数据）
- 后台项目管理页

## 6. 后台信息架构（Phase 1）

### 6.1 项目管理编辑器（手动保存）
- 左侧：分类列表 + 项目列表（支持搜索/过滤/分页）
- 右侧：项目表单（分组字段、图片上传、tags 输入）
- 顶部：保存按钮（显式保存）、导入/导出入口

### 6.2 分类管理
- 分类 CRUD + sort_index 调整

## 7. 安全与权限（Phase 1 预留，Phase 2 实施）

Phase 1：
- 写接口预留鉴权挂点（中间件），先不做智教联盟登录耦合。

Phase 2：
- OIDC 登录后本地落库 users + user_identities
- roles 表维护 admin
- 写接口要求 admin

## 8. 风险与缓解
- DB 引入复杂度：使用 docker-compose 简化本地开发
- 迁移字段不一致：Phase 1 先落最小字段集合，剩余字段以增量迁移补齐
- CSV 导入误更新：优先 slug，name 仅作为后备；多匹配拒绝导入

## 9. 验收标准（Phase 1）
- 前台项目列表与详情完全由 DB API 驱动（不再依赖本地 JSON 真源）
- 后台可看到所有已有项目（导入后），支持编辑并保存生效
- 导出 JSON/CSV 可用；导入 JSON/CSV 可用（字段缺失/多余列可容忍）
- slug 稳定，改名不影响项目详情访问

