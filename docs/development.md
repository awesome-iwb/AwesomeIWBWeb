# AwesomeIWBWeb 开发指南

## 1. 项目性质

本仓库是一个网页应用工程（前端 + 后端 + 数据 + 运维脚本），不是 README 文档项目。

## 2. 技术栈

- 前端：Vue 3 + TypeScript + Vite + vite-ssg + Tailwind
- 后端：Bun + Elysia + PostgreSQL（可选）
- 测试：`bun test`

## 3. 本地开发

### 后端

```bash
cd backend
bun install
bun run dev
```

### 前端

```bash
cd frontend
bun install
bun run dev -- --host 0.0.0.0 --port 5173
```

## 4. 数据模式

后端支持两种模式：

- DB 模式：设置 `DATABASE_URL`，自动执行 `backend/migrations/*.sql`
- JSON 模式：未设置 `DATABASE_URL`，读写 `backend/runtime/*.json`

构建与路由预渲染基于 `backend/src/data.json`，见 `frontend/vite.config.ts`。

## 5. 常用命令

```bash
# backend
cd backend
bun test

# frontend
cd frontend
bun run test
bun run build
```

## 6. 协作约定（核心）

- 不再通过根 README 维护业务条目内容。
- 内容更新应通过结构化数据与后台流程完成。
- 新增功能优先落到 `frontend/`、`backend/`、`docs/` 与结构化数据层。

## 7. 推荐阅读

- `docs/architecture/data-flow.md`
- `docs/content/maintenance.md`
- `docs/operations/sync-and-release.md`
- `docs/operations/security-note.md`

