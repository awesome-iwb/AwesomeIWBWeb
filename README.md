# AwesomeIWBWeb

> 上线必读：`deploy/README.md`

AwesomeIWBWeb 是一个面向班级大屏场景的**网页应用**，而不是纯文档仓库。  
项目由前端站点、后端 API、内容数据与运营工具组成，支持公开展示、后台管理、开发者提交流程。

## 项目定位

- 网站前端：项目浏览、检索、详情、对比、专题内容
- 后端服务：项目数据、分类管理、投稿审核、审计与回滚
- 内容运营：支持结构化数据维护与飞书快照同步

## 快速启动

### 方式一：一键启动（Windows PowerShell）

```powershell
./start-dev.ps1
```

### 方式二：手动启动

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

- 前端默认地址：`http://localhost:5173`
- 后端默认地址：`http://localhost:8080`

## 仓库结构

```text
.
├─ frontend/          # 网站前端（Vue + Vite + SSG）
├─ backend/           # API 与数据服务（Elysia + Bun）
├─ docs/              # 开发、架构、运维与内容文档
├─ data/              # 历史/结构化内容数据
├─ scripts/           # 迁移与运维脚本
└─ images/            # 历史资源目录（逐步迁移至 frontend/public/assets）
```

## 文档入口

- 开发与本地运行：`docs/development.md`
- 架构与数据真源：`docs/architecture/data-flow.md`
- 内容维护流程：`docs/content/maintenance.md`
- 运维与同步流程：`docs/operations/sync-and-release.md`
- 部署文档：`docs/deploy/`

## 内容真源说明（重要）

- 开发/构建真源：`backend/src/data.json`
- 运行时持久化：`backend/runtime/*.json`
- 飞书快照：仅作为导入输入，不直接作为页面渲染真源

详情见：`docs/architecture/data-flow.md`

## 生产鉴权说明

当前生产方案为：**Casdoor/OAuth 主登录 + 超管应急密码登录（仅 `lincube`）**。  
除 `lincube` 外，所有账号必须走第三方登录；`lincube` 首次登录后需立即改密。详见：

- `docs/operations/security-note.md`
- `docs/deploy/30-生产化改造记录.md`
- `deploy/README.md`

## 从“README 文档”迁移而来

历史版本曾以超长 README 作为主展示载体。现已转向网页化与结构化数据驱动。  
原目录型内容已进入迁移治理流程，详见：

- `docs/content/readme-migration.md`

