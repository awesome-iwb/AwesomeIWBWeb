# Linux 服务器部署（DB 模式 + Nginx 反代整站）

目标：在一台单机 Linux 服务器上把 Awesome IWB 以 **DB 模式**跑起来，对外通过 **Nginx** 提供站点访问，并把 `/api` 反代到后端。

本指南默认：
- OS：Ubuntu / Debian（apt 系）
- DB：PostgreSQL（默认用 Docker Compose 启动，最省事）
- 后端：Bun + Elysia（监听 `127.0.0.1:8080`）
- 前端：Vite 构建产物（`frontend/dist`）由 Nginx 直接静态托管
- HTTPS：单独脚本处理（见下文）

## 0. 服务器准备

- 准备一个域名并解析到服务器（A/AAAA）
- 开放端口：
  - 80（HTTP，Let’s Encrypt 也需要）
  - 443（HTTPS，后续开启）

## 1. 一键部署脚本（推荐）

脚本位置： [bootstrap.sh](file:///workspace/awesome-iwb/scripts/deploy/bootstrap.sh)

在服务器上执行（以 root 或有 sudo 权限的用户执行）：

```bash
curl -fsSL https://raw.githubusercontent.com/<YOUR_ORG>/<YOUR_REPO>/main/scripts/deploy/bootstrap.sh -o bootstrap.sh
chmod +x bootstrap.sh

sudo REPO_URL='https://github.com/<YOUR_ORG>/<YOUR_REPO>.git' \
  BRANCH='main' \
  DOMAIN='example.com' \
  ./bootstrap.sh
```

执行完成后：
- 后端 systemd 服务：`awesome-iwb-backend.service`
- Nginx 站点：`/etc/nginx/sites-available/awesome-iwb.conf`
- 前端静态文件：`/opt/awesome-iwb/frontend/dist`
- PostgreSQL（Docker）：`backend/docker-compose.yml` 启动的 `postgres` 容器

## 2. 常用运维命令

后端状态：

```bash
sudo systemctl status awesome-iwb-backend --no-pager
sudo journalctl -u awesome-iwb-backend -n 200 --no-pager
```

后端重启：

```bash
sudo systemctl restart awesome-iwb-backend
```

Nginx 检查与重载：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

数据库（Docker Compose）：

```bash
cd /opt/awesome-iwb/backend
docker compose ps
docker compose logs -n 200 postgres
```

## 3. 如何确认当前是 DB 模式（不是 JSON 模式）

后端是否 DB 模式由 `DATABASE_URL` 决定（存在即 DB）。

确认方法：

```bash
curl -sS http://127.0.0.1:8080/api/projects | python3 - <<'PY'
import sys, json
j=json.load(sys.stdin)
first=None
for c in j.get('categories', []):
  ps=c.get('projects') or []
  if ps:
    first=ps[0]
    break
print('has_id', isinstance(first, dict) and 'id' in first)
print('has_slug', isinstance(first, dict) and 'slug' in first)
PY
```

- DB 模式：通常能看到 `id` / `slug`
- JSON 模式：通常只有 `name` 等字段

## 4. HTTPS（单独脚本）

脚本位置： [enable-https.sh](file:///workspace/awesome-iwb/scripts/deploy/enable-https.sh)

前置条件：
- DNS 已生效（域名能解析到这台机子）
- Nginx 已通过 HTTP 正常提供站点（端口 80）

执行：

```bash
sudo DOMAIN='example.com' ./scripts/deploy/enable-https.sh
```

## 5. 配置与安全建议

- 默认 DB 密码来自 `backend/docker-compose.yml`，用于快速启动；生产环境请自行更换密码与连接串。
- `DATABASE_URL` 存放在 `/etc/awesome-iwb/backend.env`，权限建议保持 600。

