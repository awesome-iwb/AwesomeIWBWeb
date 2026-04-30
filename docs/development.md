# Awesome IWB 开发手册

本手册面向：新开发者、维护者。

## 技术栈与运行方式

- Runtime/包管理：Bun
- 后端：Elysia（运行端口默认 8080）
- 前端：Vue 3 + Vite（开发端口默认 5173）+ Tailwind CSS
- 前端 SSG：vite-ssg

开发时建议同时启动前后端：

```bash
# Terminal A
cd backend
bun install
bun run dev

# Terminal B
cd frontend
bun install
bun run dev -- --host 0.0.0.0 --port 5173
```

前端会通过 Vite proxy 把 `/api/*` 转发到后端：
- 配置见 [vite.config.ts](file:///workspace/awesome-iwb/frontend/vite.config.ts#L34-L41)

## 目录结构速览（关键路径）

### 后端（backend）

- 入口与路由： [index.ts](file:///workspace/awesome-iwb/backend/src/index.ts)
- 数据模式（DB / JSON）：
  - DB 相关： [db/](file:///workspace/awesome-iwb/backend/src/db)
  - JSON runtime 持久化：`backend/runtime/*.json`
  - Seed 数据： [data.json](file:///workspace/awesome-iwb/backend/src/data.json)
- 项目/分类服务（DB 模式核心）： [projects.ts](file:///workspace/awesome-iwb/backend/src/services/projects.ts)
- AI 使用率三态（兼容旧字段）： [aiUsage.ts](file:///workspace/awesome-iwb/backend/src/domain/aiUsage.ts)

### 前端（frontend）

- 首页（应用商场）： [HomeView.vue](file:///workspace/awesome-iwb/frontend/src/views/HomeView.vue)
- 详情页： [ProjectDetailView.vue](file:///workspace/awesome-iwb/frontend/src/views/ProjectDetailView.vue)
- 管理后台： [AdminView.vue](file:///workspace/awesome-iwb/frontend/src/views/AdminView.vue)
- 数据获取 composable： [useProjects.ts](file:///workspace/awesome-iwb/frontend/src/composables/useProjects.ts)
- “悬停预览”逻辑：
  - 纯函数（可测试）： [projectPreview.ts](file:///workspace/awesome-iwb/frontend/src/utils/projectPreview.ts)
  - 浮层组件： [ProjectPreviewOverlay.vue](file:///workspace/awesome-iwb/frontend/src/components/ProjectPreviewOverlay.vue)

## 后端数据模式（DB vs JSON）

后端支持两种模式，通过环境变量 `DATABASE_URL` 控制：

- **DB 模式（推荐生产）**
  - 条件：设置 `DATABASE_URL`
  - 启动时会自动跑迁移：见 [migrate.ts](file:///workspace/awesome-iwb/backend/src/db/migrate.ts)
  - 读写走 PostgreSQL
  - 本地快速启动 PostgreSQL（仓库自带 compose）：[docker-compose.yml](file:///workspace/awesome-iwb/backend/docker-compose.yml)

    ```bash
    cd backend
    docker compose up -d
    ```

  - 本地示例连接串：

    ```bash
    export DATABASE_URL='postgres://awesome_iwb:awesome_iwb_dev@127.0.0.1:5432/awesome_iwb'
    bun run dev
    ```

  - 如何确认当前是 DB 模式：
    - `GET /api/projects` 返回的项目对象包含 `id` / `slug` 等字段（来自数据库表），而不是只有 `name` 等 JSON 字段
- **JSON 模式（默认开发/演示）**
  - 条件：未设置 `DATABASE_URL`
  - 首次启动会从 seed 加载：`backend/src/data.json`
  - 运行时写入：`backend/runtime/data.json`
  - 管理后台对项目/分类的增删改会直接改 runtime 文件（即“文件真源”）

## 前端路由与 SSG

本项目使用 `vite-ssg` 做静态生成。

- Vite 配置会读取 `backend/src/data.json` 生成预渲染路由列表：
  - 见 [vite.config.ts](file:///workspace/awesome-iwb/frontend/vite.config.ts#L8-L12)
- 因此：**前端构建（SSG）依赖 seed 数据文件**。如果你只改了 runtime 数据但没同步 seed，SSG 构建出来的静态路由可能不会包含新项目。

## API 快速索引（开发常用）

公开接口：
- `GET /api/projects`：返回 catalog（categories + projects）
- `GET /api/projects/:name`：按 name/slug 获取项目详情
- `GET /api/categories`：返回分类列表
- `GET /api/stats`：返回统计信息

管理接口（管理后台使用）：
- `GET /api/admin/projects`：分页项目
- `POST /api/admin/projects`：创建项目
- `PUT /api/admin/projects/:id`：更新项目
- `DELETE /api/admin/projects/:id`：删除项目
- `GET /api/admin/categories`：分类列表
- `POST /api/admin/categories` / `PUT` / `DELETE`：分类管理

## AI 使用率标签（三态）

字段：`ai_usage_state`，取值：
- `unknown`：未知（详情页点击后会进入持续转圈）
- `over50`：AI 使用率 > 50%
- `under50`：AI 使用率 <= 50%

兼容逻辑（旧字段）：
- `ai_generated: true` → `over50`
- `human_verified: true` → `under50`

实现见：
- 后端归一化： [aiUsage.ts](file:///workspace/awesome-iwb/backend/src/domain/aiUsage.ts)
- 详情页渲染： [ProjectDetailView.vue](file:///workspace/awesome-iwb/frontend/src/views/ProjectDetailView.vue#L34-L120)
- 后台编辑： [AdminView.vue](file:///workspace/awesome-iwb/frontend/src/views/AdminView.vue#L786-L799)

## 项目卡片悬停预览（3D Touch 风格）

行为概览：
- 桌面端悬停：立刻进入 zoom，并在 5 秒后（有 banner 才）弹出浮层预览
- 移动端长按：700ms 触发，带 10px 移动阈值避免滚动误触
- 关闭/取消：滚动、移出、遮罩点击、Esc（桌面）

实现位置：
- 交互状态机： [HomeView.vue](file:///workspace/awesome-iwb/frontend/src/views/HomeView.vue#L25-L230)
- 定位与阈值函数： [projectPreview.ts](file:///workspace/awesome-iwb/frontend/src/utils/projectPreview.ts)
- 浮层面板： [ProjectPreviewOverlay.vue](file:///workspace/awesome-iwb/frontend/src/components/ProjectPreviewOverlay.vue)

## 测试与校验

后端：

```bash
cd backend
bun install
bun test
```

前端（轻量单测使用 bun test；类型检查与构建使用 vue-tsc + vite-ssg）：

```bash
cd frontend
bun install
bun run test
```

## 贡献流程与规范（维护者）

### 数据修改建议

- JSON 模式下，**不要**手工编辑 `backend/runtime/data.json`（除非你明确知道自己在做什么）
- 需要稳定可追溯的 seed 数据更新：优先编辑 `backend/src/data.json`，并通过管理后台或脚本校验

### 约定

- `Project.name` 作为前端路由参数与 JSON 模式下的 id（`encodeURIComponent(name)`）使用，应保持稳定
- `Project.slug` 仅在 DB 模式下可靠（且优先用于查找）

## 常见问题（Troubleshooting）

- 前端 `vite: not found`
  - 原因：依赖未安装或 node_modules 缺失
  - 解决：在 `frontend/` 执行 `bun install`，再 `bun run dev`
- 前端构建时 `vue-tsc` 报 `TS6133`（未使用变量）
  - 这是严格类型检查导致的构建失败，需要清理未使用变量或调整 tsconfig 策略
  - 建议维护者在合并前保持 `bun run build` 可通过

## 服务器部署

- 单机 Linux（DB 模式 + Nginx 反代）：[deployment-linux.md](file:///workspace/awesome-iwb/docs/deployment-linux.md)
