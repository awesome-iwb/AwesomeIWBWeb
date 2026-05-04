# Docker Compose 部署（推荐）

本方式适合：
- 你在面板里更偏好“容器化部署”
- 你不想在宿主机上安装 PostgreSQL / Nginx
- 你希望升级回滚更简单

目标架构：
- `nginx`：对外 80/443（可选）
- `backend`：容器内运行 Bun/Elysia
- `postgres`：容器内 PostgreSQL

## 0. 前置条件

- 一台 Linux 服务器
- 已安装 Docker 与 Docker Compose（或 docker compose 子命令）
- 已准备域名并解析到服务器（如需要 HTTPS）

## 1. 获取代码

```bash
git clone <YOUR_REPO_GIT_URL> awesome-iwb
cd awesome-iwb
```

## 2. 准备环境变量

建议在服务器上创建一个 `.env`（不要提交到仓库）：

```bash
cat > .env <<'EOF'
POSTGRES_DB=awesome_iwb
POSTGRES_USER=awesome_iwb
POSTGRES_PASSWORD=PLEASE_CHANGE_ME
DATABASE_URL=postgres://awesome_iwb:PLEASE_CHANGE_ME@postgres:5432/awesome_iwb
EOF
```

说明：
- `DATABASE_URL` 指向容器网络内的 `postgres` 服务名
- 后端检测到 `DATABASE_URL` 后会自动进入 DB 模式并执行 migrations

## 3. 编写 docker-compose.yml

在仓库根目录创建 `docker-compose.yml`（示例）：

```yaml
services:
  postgres:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 20

  backend:
    image: oven/bun:1.2.14
    restart: unless-stopped
    working_dir: /app/backend
    environment:
      DATABASE_URL: ${DATABASE_URL}
    volumes:
      - ./backend:/app/backend
    command: ["bun", "run", "start"]
    depends_on:
      postgres:
        condition: service_healthy

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
    volumes:
      - ./frontend/dist:/usr/share/nginx/html:ro
      - ./deploy/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - backend

volumes:
  pgdata:
```

注意：
- 这里用 volume 直接挂载源码是为了简单；生产可改为多阶段构建镜像
- `frontend/dist` 必须先在宿主机生成（见下一节）

## 4. 构建前端静态文件

```bash
cd frontend
bun install
bun run build
cd ..
```

## 5. Nginx 反代配置

创建 `deploy/nginx.conf`：

```nginx
server {
  listen 80;
  server_name _;

  location /api/ {
    proxy_pass http://backend:8080/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    root /usr/share/nginx/html;
    try_files $uri $uri/ /index.html;
  }
}
```

## 6. 启动

```bash
docker compose up -d
docker compose ps
```

验证：
- `curl -sS http://127.0.0.1/api/projects | head`
- 浏览器打开 `http://<你的域名或IP>/`

## 7. 启用 HTTPS（可选）

Docker 场景下推荐：
- 在宿主机或面板层面做 HTTPS（反代到容器 80）
- 或使用 `caddy` / `nginx-proxy-manager` 作为统一入口

如果你希望本文档也覆盖容器内 HTTPS，可以把 Nginx 换成 Caddy 并挂载证书目录（建议单独做）。

