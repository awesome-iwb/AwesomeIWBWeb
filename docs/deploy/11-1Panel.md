# 1Panel 部署教程

1Panel 常见两种用法：
- 全容器化（推荐）：用 1Panel 的应用/Compose 管理 PostgreSQL + Nginx（或 Caddy）+ 后端
- 半原生：1Panel 管理站点与反代，后端用 systemd（更接近“生产原生”）

本文给出两套流程，你按你的面板习惯选其一。

## 方案 A：全容器化（推荐）

### 1) 上传/拉取代码

把项目放到服务器目录，例如：

`/opt/awesome-iwb`

```bash
git clone <YOUR_REPO_GIT_URL> /opt/awesome-iwb
```

### 2) 构建前端 dist

```bash
cd /opt/awesome-iwb/frontend
bun install --no-progress
bun run build
```

### 3) 在 1Panel 创建 Compose

在 1Panel → 容器 → 编排（Compose）中新建一个编排，参考 `docs/deploy/01-Docker-Compose-部署.md` 的 compose 内容。

建议你把敏感信息写进 1Panel 的环境变量或 `.env`：
- `POSTGRES_PASSWORD`
- `DATABASE_URL`

### 4) 网站与反代

如果你不用容器内 Nginx，而是让 1Panel 的网站功能管理 Nginx/Caddy：
- 静态目录指向：`/opt/awesome-iwb/frontend/dist`
- 反代：`/api` → `http://127.0.0.1:8080`

## 方案 B：1Panel 管网站，后端 systemd（半原生）

### 1) 按原生方式部署后端

参考 `docs/deploy/03-Linux-原生部署.md`：
- PostgreSQL 可用 1Panel 的数据库应用，或原生安装
- 后端用 systemd 管理

### 2) 用 1Panel 配置网站与 SSL

在 1Panel 创建网站：
- 根目录：`/opt/awesome-iwb/frontend/dist`
- SSL：Let’s Encrypt
- 反向代理：`/api` → `http://127.0.0.1:8080`

## 常见问题

### 1) 1Panel 的反代如何写？

核心只要保证：
- `/api/*` 走后端
- 其他路径走静态文件并 fallback 到 `/index.html`

### 2) DB migrations 要怎么跑？

不需要单独执行，后端在 DB 模式启动时会自动执行 migrations。

